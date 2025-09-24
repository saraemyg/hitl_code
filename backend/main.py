from fastapi import FastAPI, File, UploadFile, HTTPException, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pymongo import MongoClient
from dotenv import load_dotenv
from pathlib import Path

import shutil
import tempfile
import time
import logging
import uvicorn
import os
import json
import numpy as np
from PIL import Image
from datetime import datetime
from typing import List

from model_handler import PlantDefectDetector
# from yolo_converter import convert_to_yolov11

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables from .env
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME", "hitl_db")

# MongoDB Connection 
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
images = db["images"]

# * optimise this later for multiple model selection
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
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root(): return {"message": "hello haha world"}

# Base folder where metadata is stored
app.mount("/data", StaticFiles(directory="data"), name="data")

DATA_ROOT = "data"
DETECTION_VERSION = "detection_v1"  # default
VERSION_DIR = os.path.join(DATA_ROOT, DETECTION_VERSION)

original_dir = os.path.join(VERSION_DIR, "original_img")   
processed_dir = os.path.join(VERSION_DIR, "processed_img") 
crops_dir = os.path.join(VERSION_DIR, "crops")             
default_metadata_file = os.path.join(VERSION_DIR, f"{DETECTION_VERSION}_metadata.json")  

@app.get("/metadata")
async def get_metadata(file: str = Query(default=default_metadata_file, description="Metadata file path")):
    if os.path.exists(file):
        try:
            with open(file, "r") as f:
                metadata = json.load(f)
            return JSONResponse(content=metadata)
        except json.JSONDecodeError:
            return JSONResponse(content={"error": f"Invalid JSON format in {file}"}, status_code=500)
    return JSONResponse(content={"error": f"Metadata file '{file}' not found"}, status_code=404)

@app.get("/metadata/files")
async def list_metadata_files():
    """List all available metadata JSON files under data/"""
    if not os.path.exists(DATA_ROOT):
        return JSONResponse(content={"files": []})

    files = []
    # Walk through each detection version folder
    for root, _, filenames in os.walk(DATA_ROOT):
        for f in filenames:
            if f.endswith("_metadata.json"):
                # return relative path (e.g. detection_v1/detection_v1_metadata.json)
                rel_path = os.path.relpath(os.path.join(root, f), DATA_ROOT)
                files.append(rel_path.replace("\\", "/"))

    return JSONResponse(content={"files": files})
    
# Helper Functions -------------------------------------------------
def load_metadata(file: str = default_metadata_file):
    if not os.path.exists(file):
        return []
    with open(file, "r") as f:
        metadata = json.load(f)

    # Clean metadata: only keep detections where crop file exists
    cleaned_metadata = []
    for item in metadata:
        valid_detections = []
        for det in item.get("detections", []):
            crop_path = det.get("crop")
            if crop_path and os.path.exists(crop_path.replace("\\", "/")):
                valid_detections.append(det)
        item["detections"] = valid_detections
        cleaned_metadata.append(item)
    return cleaned_metadata

def save_metadata(results: list, metadata_file: str = default_metadata_file):
    # Strip "data/" prefix if present before saving
    for entry in results:
        if entry.get("uploaded_img", "").startswith("data/"):
            entry["uploaded_img"] = entry["uploaded_img"].replace("data/", "", 1)
        if entry.get("processed_img", "").startswith("data/"):
            entry["processed_img"] = entry["processed_img"].replace("data/", "", 1)

        for det in entry.get("detections", []):
            if det.get("crop", "").startswith("data/"):
                det["crop"] = det["crop"].replace("data/", "", 1)

    with open(metadata_file, "w") as f:
        json.dump(results, f, indent=2)

# Validation Process ------------------------------------------
@app.patch("/detections/validate")
async def validate_detection(body: dict = Body(...)):
    crop = body.get("crop")
    if not crop:
        raise HTTPException(status_code=400, detail="Crop not provided")
    decision = body.get("decision")
    status_map = {
        "correct": "validated",
        "healthy": "healthy",
        "other": "validated",
        "uncertain": "uncertain"
    }

    metadata = load_metadata()
    req_filename = Path(crop).name

    for item in metadata:
        for det in item.get("detections", []):
            det_crop_filename = Path(det.get("crop_path") or det.get("crop") or "").name
            if det_crop_filename == req_filename:
                if decision in status_map:
                    det["status"] = status_map[decision]
                if decision == "other" and "type" in body:
                    det["type"] = body["type"]
                save_metadata(metadata)
                return {"updated": det}
    raise HTTPException(status_code=404, detail="Detection not found")

# Detection Pipeline --------------------------------------------

@app.post("/bulk-detect")
async def bulk_detect(request_data: dict):
    model_name = request_data.get("model", "HQx1280")
    os.makedirs(processed_dir, exist_ok=True)
    os.makedirs(crops_dir, exist_ok=True)

    # Load existing metadata
    if os.path.exists(default_metadata_file):
        with open(default_metadata_file, "r") as f:
            existing_metadata = {item["uploaded_img"]: item for item in json.load(f)}
    else:
        existing_metadata = {}

    results = []
    image_files = [f for f in os.listdir(original_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]

    for image_file in image_files:
        file_path = os.path.join(original_dir, image_file)
        try:
            image = Image.open(file_path)
            if image.mode != 'RGB':
                image = image.convert('RGB')
            image_array = np.array(image)

            detections, annotated_image = detector.predict(image_array, return_image=True)

            annotated_filename = f"{os.path.splitext(image_file)[0]}_processed.jpg"
            annotated_path = os.path.join(processed_dir, annotated_filename)

            if annotated_image is not None:
                annotated_rgb = annotated_image[..., ::-1]
                annotated_pil = Image.fromarray(annotated_rgb)
                annotated_pil.save(annotated_path)

            new_entry = { # always forward slashes → works cross-platform
                "uploaded_img": os.path.join(DETECTION_VERSION, "original_img", image_file).replace("\\", "/"),
                "processed_img": os.path.join(DETECTION_VERSION, "processed_img", annotated_filename).replace("\\", "/"),
                "detections": detections,
                "defect_count": len(detections),
                "version": DETECTION_VERSION
            }

            # Preserve old statuses
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

    save_metadata(results)
    logger.info(f"Metadata saved to: {default_metadata_file}")

    return {
        "success": True,
        "processed": len(results),
        "results": results
    }

@app.post("/upload-images")
async def upload_images(files: List[UploadFile] = File(...)):
    os.makedirs(original_dir, exist_ok=True)
    saved_files, skipped_files = [], []

    for file in files:
        saved_filename = file.filename
        file_path = os.path.join(original_dir, saved_filename)

        if os.path.exists(file_path):
            logger.info(f"Skipped duplicate file: {file_path}")
            skipped_files.append(saved_filename)
            continue

        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)

        logger.info(f"Image uploaded and saved to: {file_path}")
        saved_files.append(saved_filename)

    return {"success": True, "saved_files": saved_files, "skipped_files": skipped_files}

# @app.post("/convert-yolov11")
# async def convert_yolov11():
#     timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
#     output_dir = os.path.join("yolov11",f"yolov11_format{timestamp}")
#     result = convert_to_yolov11(metadata_path, output_dir)
#     return {
#         "status": "success",
#         "output_dir": output_dir,
#         "timestamp": timestamp
#     }

# * to be adjusted
@app.get("/download-annotations")
async def download_annotations():
    try:
        # Step 1: Convert to YOLOv11 format
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = os.path.join("yolov11", f"yolov11_format_{timestamp}")
        os.makedirs(output_dir, exist_ok=True)
        # convert_to_yolov11(metadata_path, output_dir)

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

# * to be adjusted
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
