from fastapi import FastAPI, File, UploadFile, HTTPException, Body, Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
import shutil
import tempfile
import time
import logging
import uvicorn
from contextlib import asynccontextmanager
from PIL import Image
import io
import numpy as np
import os
from datetime import datetime
from typing import List
import json

from model_handler import PlantDefectDetector
from yolo_converter import convert_to_yolov11

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

detector = PlantDefectDetector("models/HQx1280.pt")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Loading model from startup...")
    start_time = time.time()
    try: 
        detector.load_model()
        elapsed = time.time() - start_time
        logger.info(f"Model {detector.model_path} successfully loaded in {elapsed:.2f} seconds")
    except Exception as e:
        logger.error(f"error loading model: {e}")
        raise
    yield

    logger.info("app is shutting down...")

app = FastAPI(title="Plant Defect Detection API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # change later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve the outputs folder as static files
app.mount("/uploaded_img", StaticFiles(directory="uploaded_img"), name="uploaded_img")
app.mount("/processed_img", StaticFiles(directory="processed_img"), name="processed_img")
metadata_path = os.path.join("processed_img", "detection_metadata.json")

@app.get("/")
def root():
    return {"message": "hello haha world"}

# New endpoint to always fetch fresh metadata
# PLEASE OPTIMISE THIS HAHA
@app.get("/metadata")
async def get_metadata():
    metadata_path = os.path.join("processed_img", "detection_metadata.json")
    if os.path.exists(metadata_path):
        with open(metadata_path, "r") as f:
            metadata = json.load(f)
        return JSONResponse(content=metadata)
    return JSONResponse(content={"error": "No metadata found"}, status_code=404)

#----validation process------------------------------------------

def load_metadata():
    if not os.path.exists(metadata_path):
        return []
    with open(metadata_path, "r") as f:
        metadata = json.load(f)
    # Clean metadata: only keep detections where crop file actually exists
    # Fix here for issue with 'healthy' image for viewing
    cleaned_metadata = []
    for item in metadata:
        valid_detections = []
        for det in item.get("detections", []):
            crop_path = det.get("crop_path")
            if crop_path and os.path.exists(crop_path.replace("\\", "/")):
                valid_detections.append(det)
        item["detections"] = valid_detections
        cleaned_metadata.append(item)
    return cleaned_metadata

def save_metadata(metadata):
    os.makedirs(os.path.dirname(metadata_path), exist_ok=True)
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

@app.patch("/detections/{confidence}/validate")
async def validate_detection(confidence: int, body: dict = Body(...)):
    metadata = load_metadata()
    decision = body.get("decision")
    status_map = { "correct": "validated", "healthy": "healthy", 
                  "other": "validated", "uncertain": "uncertain",}
    for item in metadata:
        for det in item.get("detections", []):
            if det.get("confidence") == confidence:
                if decision in status_map:
                    det["status"] = status_map[decision]
                if decision == "other" and "defect_type" in body:
                    det["defect_type"] = body["defect_type"]
                # Save metadata back
                save_metadata(metadata)
                return {"updated": det}
    return {"error": "Detection not found"}

@app.delete("/detections/{confidence}")
async def delete_detection(confidence: int):
    metadata = load_metadata()
    deleted = None
    for item in metadata:
        detections = item.get("detections", [])
        for det in detections:
            if det["confidence"] == confidence: 
                detections.remove(det)
                deleted = det
                break
        if deleted:
            break
    if not deleted:
        raise HTTPException(status_code=404, detail="Detection not found")
    save_metadata(metadata)
    return {"success": True, "deleted": deleted}

# Add this new endpoint after your existing endpoints

@app.patch("/update-detection")
async def update_detection(body: dict = Body(...)):
    """Update detection bbox and metadata"""
    try:
        image_name = body.get("image_name")
        detection_id = body.get("detection_id")
        new_bbox = body.get("bbox")
        new_defect_type = body.get("defect_type")
        
        if not all([image_name, detection_id, new_bbox]):
            raise HTTPException(
                status_code=400, 
                detail="Missing required fields: image_name, detection_id, or bbox"
            )

        # Load existing metadata
        metadata = load_metadata()
        
        # Find the image and detection
        image_found = False
        detection_updated = False
        
        for image in metadata:
            if image["uploaded_img"] == image_name:
                image_found = True
                for detection in image["detections"]:
                    if detection["defect_id"] == detection_id:
                        # Update bbox
                        detection["bbox"] = new_bbox
                        # Update defect type if provided
                        if new_defect_type:
                            detection["defect_type"] = new_defect_type
                        detection_updated = True
                        break
                break
        
        if not image_found:
            raise HTTPException(status_code=404, detail="Image not found")
        if not detection_updated:
            raise HTTPException(status_code=404, detail="Detection not found")

        # Save updated metadata
        save_metadata(metadata)

        return {
            "success": True,
            "message": "Detection updated successfully",
            "updated_detection": {
                "defect_id": detection_id,
                "bbox": new_bbox,
                "defect_type": new_defect_type if new_defect_type else None
            }
        }

    except Exception as e:
        logger.error(f"Error updating detection: {e}")
        raise HTTPException(status_code=500, detail=str(e))

#-----basic process--------------------------------------------

@app.post("/detect")
async def detect_defects(file: UploadFile = File(...)):
    # from fakhrul, use as reference
    logger.info(f"Detect route endpoint was called with file: {file.filename}")
    start_time = time.time()

    try:
        if not detector.is_loaded:
            raise HTTPException(status_code=503, detail="model not loaded")
        
        logger.info("Analyzing image...")
        contents = await file.read()

        try:
            image = Image.open(io.BytesIO(contents))
        except Exception as e:
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        if image.mode != 'RGB':
            logger.info("Converting image...")
            image = image.convert('RGB')

        image_array = np.array(image)

        logger.info("Running prediction...")
        detections, annotated_image = detector.predict(image_array, return_image=True)

        # save image
        output_dir = "processed_img"
        os.makedirs(output_dir, exist_ok=True)

        # image file name, just metadata stuff
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_extension = os.path.splitext(file.filename)[1] if file.filename else '.jpg'
        saved_filename = f"{timestamp}_processed{file_extension}.jpg"
        file_path = os.path.join(output_dir, saved_filename)

        # convert bgr to rgb back, then save image using PIL
        if annotated_image is not None:
            annotated_rgb = annotated_image[..., ::-1]
            annotated_pil = Image.fromarray(annotated_rgb)
            annotated_pil.save(file_path)
            logger.info(f"Processed image saved to: {file_path}")
        
        processing_time = time.time() - start_time
        logger.info(f"Detection completed in {processing_time:.2f} seconds")

        return {
            "success": True,
            "filename": file.filename,
            "saved_path": file_path,
            "detections": detections,
            "defect_count": len(detections),
            "processing_time": processing_time
        }

    except Exception as e:
        logger.error(f"Detection failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/bulk-detect")
async def bulk_detect(data: dict):
    model_name = data.get("model", "HQx1280")  # Default to HQx1280 if not specified
    input_dir = "uploaded_img"
    output_dir = "processed_img"
    os.makedirs(output_dir, exist_ok=True)

    metadata_path = os.path.join(output_dir, "detection_metadata.json")

    # Load old metadata if exists
    if os.path.exists(metadata_path):
        with open(metadata_path, "r") as f:
            existing_metadata = {item["uploaded_img"]: item for item in json.load(f)}
    else:
        existing_metadata = {}

    results = []
    image_files = [f for f in os.listdir(input_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]

    for image_file in image_files:
        file_path = os.path.join(input_dir, image_file)
        try:
            image = Image.open(file_path)
            if image.mode != 'RGB':
                image = image.convert('RGB')
            image_array = np.array(image)

            detections, annotated_image = detector.predict(image_array, return_image=True)

            # Reuse old processed filename if available, otherwise generate new one
            if image_file in existing_metadata and "processed_img" in existing_metadata[image_file]:
                annotated_filename = existing_metadata[image_file]["processed_img"]
            else:
                annotated_filename = f"{os.path.splitext(image_file)[0]}_processed.jpg"

            annotated_path = os.path.join(output_dir, annotated_filename)

            # Save/update annotated image (overwrite safely)
            if annotated_image is not None:
                annotated_rgb = annotated_image[..., ::-1]
                annotated_pil = Image.fromarray(annotated_rgb)
                annotated_pil.save(annotated_path)

            new_entry = {
                "uploaded_img": image_file,
                "processed_img": annotated_filename,
                "detections": detections,
                "defect_count": len(detections)
            }

            # If image exists already in metadata, preserve validated statuses
            if image_file in existing_metadata:
                old_entry = existing_metadata[image_file]

                old_detections = {d["defect_id"]: d for d in old_entry.get("detections", [])}
                for det in new_entry["detections"]:
                    if det["defect_id"] in old_detections:
                        det["status"] = old_detections[det["defect_id"]].get("status", "unvalidated")

            results.append(new_entry)

        except Exception as e:
            logger.error(f"Failed to process {image_file}: {e}")
            results.append({
                "uploaded_img": image_file,
                "error": str(e)
            })

    # Save merged metadata
    with open(metadata_path, "w") as f:
        json.dump(results, f, indent=2)

    logger.info(f"Metadata saved to: {metadata_path}")

    return {
        "success": True,
        "processed": len(results),
        "results": results
    }

@app.post("/upload-images")
async def upload_images(files: List[UploadFile] = File(...)):
    # Save multiple uploaded images to the uploaded_img folder.
    input_dir = "uploaded_img"
    os.makedirs(input_dir, exist_ok=True)
    saved_files = []
    skipped_files = []

    for file in files:
        saved_filename = f"{file.filename}"
        file_path = os.path.join(input_dir, saved_filename)

        # Check if file already exists
        if os.path.exists(file_path):
            logger.info(f"Skipped duplicate file: {file_path}")
            skipped_files.append(saved_filename)
            continue  # skip saving
        # Save new file
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)

        logger.info(f"Image uploaded and saved to: {file_path}")
        saved_files.append(saved_filename)

    return {
        "success": True,
        "saved_files": saved_files
    }

@app.post("/convert-yolov11")
async def convert_yolov11():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = os.path.join("yolov11",f"yolov11_format{timestamp}")
    result = convert_to_yolov11(metadata_path, output_dir)
    return {
        "status": "success",
        "output_dir": output_dir,
        "timestamp": timestamp
    }

@app.get("/download-annotations")
async def download_annotations():
    try:
        # Step 1: Convert to YOLOv11 format
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = os.path.join("yolov11", f"yolov11_format_{timestamp}")
        os.makedirs(output_dir, exist_ok=True)
        convert_to_yolov11(metadata_path, output_dir)

        # Step 2: Zip the folder
        zip_filename = f"annotations_{timestamp}.zip"
        zip_path = os.path.join(tempfile.gettempdir(), zip_filename)
        shutil.make_archive(zip_path.replace(".zip", ""), "zip", output_dir)

        # Step 3: Return file for download
        return FileResponse(
            path=zip_path,
            filename=zip_filename,
            media_type="application/zip"
        )
    except Exception as e:
        logger.error(f"Download annotations failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/clear-folder/{folder_type}")
def clear_folder(folder_type: str):

    FOLDER_PATHS = { "uploaded": "uploaded_img", "processed": "processed_img", "converted": "yolov11"}
    folder = FOLDER_PATHS.get(folder_type.lower())

    if folder is None:
        raise HTTPException(status_code=400, detail="Invalid folder type. Use uploaded, processed, or converted.")

    if not os.path.exists(folder):
        raise HTTPException(status_code=404, detail=f"Folder '{folder}' does not exist.")

    files = os.listdir(folder)
    if not files:  # empty
        return {"message": "folder is empty already!"}

    for f in files:
        file_path = os.path.join(folder, f)
        try:
            if os.path.isfile(file_path):
                os.remove(file_path)
            elif os.path.isdir(file_path):
                shutil.rmtree(file_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error deleting {file_path}: {str(e)}")

    return {"message": f"All files in '{folder_type}' folder have been deleted."}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
