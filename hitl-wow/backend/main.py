from fastapi import FastAPI, File, UploadFile, HTTPException, Body, Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import logging
import uvicorn
from model_handler import PlantDefectDetector
import time
from contextlib import asynccontextmanager
from PIL import Image
import io
import numpy as np
import os
from datetime import datetime
from typing import List
import json

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
@app.get("/metadata")
async def get_metadata():
    metadata_path = os.path.join("processed_img", "detection_metadata.json")
    if os.path.exists(metadata_path):
        with open(metadata_path, "r") as f:
            metadata = json.load(f)
        return JSONResponse(content=metadata)
    return JSONResponse(content={"error": "No metadata found"}, status_code=404)

#-----basic process--------------------------------------------

# from fakhrul, use as reference
@app.post("/detect")
async def detect_defects(file: UploadFile = File(...)):
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
async def bulk_detect():
    input_dir = "uploaded_img"
    output_dir = "processed_img"
    os.makedirs(output_dir, exist_ok=True)

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

            # Save annotated image
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            annotated_filename = f"{timestamp}_{image_file}_processed.jpg"
            annotated_path = os.path.join(output_dir, annotated_filename)
            if annotated_image is not None:
                annotated_rgb = annotated_image[..., ::-1]
                annotated_pil = Image.fromarray(annotated_rgb)
                annotated_pil.save(annotated_path)

            results.append({
                "uploaded_img": image_file,
                "processed_img": annotated_filename,
                "detections": detections,
                "defect_count": len(detections)
            })

        except Exception as e:
            logger.error(f"Failed to process {image_file}: {e}")
            results.append({
                "uploaded_img": image_file,
                "error": str(e)
            })

    # Save metadata to a JSON file
    metadata_path = os.path.join(output_dir, "detection_metadata.json")
    with open(metadata_path, "w") as f:
        json.dump(results, f, indent=2)

    logger.info(f"Metadata saved to: {metadata_path}")

    return {
        "success": True,
        "processed": len(results),
        "results": results
    }

# Save multiple uploaded images to the uploaded_img folder.
@app.post("/upload-images")
async def upload_images(files: List[UploadFile] = File(...)):
    
    input_dir = "uploaded_img"
    os.makedirs(input_dir, exist_ok=True)
    saved_files = []

    for file in files:
        file_extension = os.path.splitext(file.filename)[1] or ".jpg"
        saved_filename = f"{file.filename}"
        file_path = os.path.join(input_dir, saved_filename)

        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)

        logger.info(f"Image uploaded and saved to: {file_path}")
        saved_files.append(saved_filename)

    return {
        "success": True,
        "saved_files": saved_files
    }

# convert metadata.json to yolov11 format ready to train ; converter.yolov11format 
# click button export, can click button download

#----validation process------------------------------------------

def load_metadata():
    if not os.path.exists(metadata_path):
        return []
    with open(metadata_path, "r") as f:
        metadata = json.load(f)
    # Clean metadata: only keep detections where crop file actually exists
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
    # Always use the fixed path, not an argument
    os.makedirs(os.path.dirname(metadata_path), exist_ok=True)
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

@app.patch("/detections/{confidence}/validate")
async def validate_detection(confidence: int, body: dict = Body(...)):
    metadata = load_metadata()
    updated = None

    for item in metadata:
        for det in item.get("detections", []):
            if det["confidence"] == confidence:  # exact string match
                decision = body.get("decision")
                if decision == "correct":
                    det["status"] = "validated"
                elif decision == "healthy":
                    det["status"] = "healthy"
                elif decision == "other":
                    det["status"] = "validated"
                    if "defect_type" in body:
                        det["defect_type"] = body["defect_type"]
                updated = det
                break
        if updated:
            break

    if not updated:
        raise HTTPException(status_code=404, detail="Detection not found")

    save_metadata(metadata)
    return {"success": True, "updated": updated}

@app.delete("/detections/{confidence}")
async def delete_detection(confidence: int):
    metadata = load_metadata()
    deleted = None

    for item in metadata:
        detections = item.get("detections", [])
        for det in detections:
            if det["confidence"] == confidence:  # exact string match
                detections.remove(det)
                deleted = det
                break
        if deleted:
            break

    if not deleted:
        raise HTTPException(status_code=404, detail="Detection not found")

    save_metadata(metadata)
    return {"success": True, "deleted": deleted}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
