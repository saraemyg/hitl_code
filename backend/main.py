from fastapi import FastAPI, File, UploadFile, HTTPException, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from bson import ObjectId
from contextlib import asynccontextmanager
from pymongo import MongoClient, errors, ASCENDING
from dotenv import load_dotenv
from urllib.parse import urlparse, unquote
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
import traceback

from model_handler import PlantDefectDetector 

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables from .env
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME", "hitl_db")
COLLECTION_NAME = "images"

# MongoDB Connection 
client = MongoClient(
    MONGO_URI, tls=True, tlsAllowInvalidCertificates=True,
    serverSelectionTimeoutMS=5000)
db = client[DB_NAME]
images = db[COLLECTION_NAME]

# Ensure indexes are created once on startup
images.create_index([("image_id", ASCENDING)])
images.create_index([("created_at", ASCENDING)])

# Model Initialisation * optimise this later for multiple model selection
DEFECT_MODEL_PATH = os.getenv("DEFECT_MODEL_PATH", "models/best0501.pt")
VIT_MODEL_PATH = os.getenv("VIT_MODEL_PATH", None)
detector = PlantDefectDetector(DEFECT_MODEL_PATH, VIT_MODEL_PATH)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Loading model from startup...")
    start_time = time.time()
    try: 
        detector.load_models()
        elapsed = time.time() - start_time
        logger.info(f"Models loaded successfully from {detector.defect_model_path} "
            f"{'(+ ViT)' if detector.vit_model_path else ''} in {elapsed:.2f} seconds")
    except Exception as e:
        logger.error(f"Error loading model: {e}")
        raise
    yield
    logger.info("App is shutting down...")

app = FastAPI(title="Plant Defect Detection API", lifespan=lifespan)

# CORS Setup
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
BASE_DIR = Path(__file__).resolve().parent.parent  # go up from backend/ to project root
DATA_ROOT = BASE_DIR / "public" / "data"
DETECTION_VERSION = "detection_v1"  # default
VERSION_DIR = DATA_ROOT / DETECTION_VERSION
original_dir = VERSION_DIR / "original_img"
processed_dir = VERSION_DIR / "processed_img"
crops_dir = VERSION_DIR / "crops"
default_metadata_file = VERSION_DIR / f"{DETECTION_VERSION}_metadata.json"

# Ensure all directories exist
for p in [original_dir, processed_dir, crops_dir]:
    p.mkdir(parents=True, exist_ok=True)

# Mount static folders for serving public data
if DATA_ROOT.exists():
    app.mount("/data", StaticFiles(directory=str(DATA_ROOT)), name="data")
    app.mount(f"/{DETECTION_VERSION}", StaticFiles(directory=str(VERSION_DIR)), name=DETECTION_VERSION)
else:
    logger.warning(f"[Static Mount Warning] DATA_ROOT not found: {DATA_ROOT}")

@app.get("/metadata")
async def get_metadata(file: str = Query(default=default_metadata_file, description="Metadata file path")):
    # Fetch metadata from MongoDB if available, else JSON fallback
    try:
        client.admin.command("ping")  # test Mongo
        print("[Mongo] Fetching metadata from Atlas")
        docs = list(images.find({}, {"_id": 0}))
        return JSONResponse(content=docs)
    except errors.PyMongoError as e:
        print(f"[Mongo Error] {e}, falling back to JSON")

    # JSON fallback
    if os.path.exists(file):
        try:
            with open(file, "r") as f:
                metadata = json.load(f)
            print(f"[JSON] Loaded metadata from {file}")
            return JSONResponse(content=metadata)
        except json.JSONDecodeError:
            print(f"[JSON] Invalid JSON format in {file}")
            return JSONResponse(content={"error": f"Invalid JSON format in {file}"}, status_code=500)
    print(f"[JSON] Metadata file '{file}' not found")
    return JSONResponse(content={"error": f"Metadata file '{file}' not found"}, status_code=404)


@app.get("/metadata/files")
async def list_metadata_files():
    """ List available metadata sources. If Mongo is up, return 'MongoDB Atlas'. Always list JSON files under data/ as fallback. """
    sources = []
    try:
        client.admin.command("ping")  # Check Mongo
        print(" [Mongo] Atlas available")
        sources.append("MongoDB Atlas")
    except errors.PyMongoError as e:
        print(f" [Mongo Error] {e}, MongoDB unavailable")

    # JSON files fallback
    if os.path.exists(DATA_ROOT):
        for root, _, filenames in os.walk(DATA_ROOT):
            for f in filenames:
                if f.endswith("_metadata.json"):
                    rel_path = os.path.relpath(os.path.join(root, f), DATA_ROOT)
                    sources.append(rel_path.replace("\\", "/"))

    print(" Available metadata sources:", sources)
    return JSONResponse(content={"files": sources})

    
# Helper Functions -------------------------------------------------
def load_metadata(file: str = default_metadata_file):
    try:
        client.admin.command("ping")  # check Mongo connection
        print(" Using MongoDB for metadata")
        return list(images.find({}, {"_id": 0}))  # strip ObjectId
    except errors.PyMongoError:
        print(" Mongo unavailable, falling back to JSON")
        if not os.path.exists(file):
            return []
        with open(file, "r") as f:
            metadata = json.load(f)

        cleaned_metadata = []
        for item in metadata:
            valid_detections = []
            for det in item.get("detections", []):
                crop_path = det.get("crop")
                if crop_path:
                    fs_path = (DATA_ROOT / crop_path).resolve()
                    if os.path.exists(fs_path):
                        valid_detections.append(det)
                    else:
                        print(f"[Missing Crop] {fs_path} not found, skipping.")
            item["detections"] = valid_detections
            cleaned_metadata.append(item)
        return cleaned_metadata


def save_metadata(results: list, metadata_file: str = default_metadata_file):
    try:
        client.admin.command("ping")
        print("✅ Saving to MongoDB")
        images.delete_many({})  # overwrite everything (same as JSON rewrite)
        if results:
            images.insert_many(results)
        return
    except errors.PyMongoError:
        print("⚠️ Mongo unavailable, saving to JSON fallback")

    # JSON fallback
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
    print("💾 Saved metadata to JSON fallback")

# Validation Process ------------------------------------------

@app.patch("/detections/validate")
async def validate_detection(body: dict = Body(...)):
    """
    This endpoint validates a detection (leaf/plant crop) or updates its plant type.
    Works for:
      - decision: "correct", "healthy", "other", "uncertain"
      - decision: "plantType" (for plant type updates)
    """

    print("=== Incoming validate request ===")
    print("Body:", body)

    # --- Step 1: Extract Crop Path ---
    crop = body.get("crop")
    if not crop:
        raise HTTPException(status_code=400, detail="Crop not provided")

    # Normalize the crop path
    parsed = urlparse(crop)
    req_path = unquote(parsed.path).lstrip("/")
    if req_path.startswith("data/"):
        req_path = req_path[len("data/"):]
    print("Normalized request crop:", req_path)

    decision = body.get("decision")

    # =======================================================
    # 🪴 Special Case: Plant Type Update
    # =======================================================
    if decision == "plantType" and "plant_type" in body:
        try:
            client.admin.command("ping")
            print("✅ Updating plant_type.code in Mongo")

            result = images.update_one(
                {"detections.crop": req_path},
                {"$set": {"plant_type.code": body["plant_type"]["code"]}}
            )

            if result.modified_count > 0:
                updated_doc = images.find_one({"detections.crop": req_path}, {"_id": 0})
                print("✅ plant_type.code updated successfully in Mongo")
                return {"updated": updated_doc}
            else:
                raise HTTPException(status_code=404, detail="No document found for crop path")

        except Exception as e:
            print("⚠️ Mongo update error:", e)
            raise HTTPException(status_code=500, detail="Mongo update failed")

    # =======================================================
    # 🌱 Regular Validation Handling
    # =======================================================
    status_map = {
        "correct": "validated",
        "healthy": "healthy",
        "other": "validated",
        "uncertain": "uncertain"
    }

    update = {"status": status_map.get(decision, "unvalidated")}

    if decision == "other" and "type" in body:
        update["type"] = body["type"]

    print("Prepared update data:", update)

    # --- Step 3: Try MongoDB Update ---
    try:
        client.admin.command("ping")
        print("✅ Using MongoDB for validation")

        result = images.update_one(
            {"detections.crop": req_path},
            {"$set": {f"detections.$.{k}": v for k, v in update.items()}}
        )

        if result.modified_count > 0:
            updated_doc = images.find_one({"detections.crop": req_path}, {"_id": 0})
            print("✅ Updated detection in MongoDB")
            return {"updated": updated_doc}
        else:
            print("⚠️ No matching detection found in Mongo for:", req_path)

    except errors.PyMongoError as e:
        print("⚠️ MongoDB error:", e)

    # --- Step 4: JSON Fallback ---
    print("⚠️ Falling back to JSON patch mode")
    metadata = load_metadata()

    for item in metadata:
        for det in item.get("detections", []):
            det_crop = det.get("crop") or ""
            if det_crop == req_path:
                print("✅ Match found in JSON! Updating detection...")

                # Handle plantType case in JSON fallback too
                if decision == "plantType" and "plant_type" in body:
                    item["plant_type"]["code"] = body["plant_type"]["code"]
                else:
                    det.update(update)

                save_metadata(metadata)
                print("💾 Detection updated and metadata saved to JSON")
                return {"updated": det}

    # --- Step 5: If Not Found ---
    print("❌ No match found for:", req_path)
    raise HTTPException(status_code=404, detail=f"Detection not found for {req_path}")

# Delete Detection
@app.delete("/detections/delete")
async def delete_detection(body: dict = Body(...)):
    print("=== Incoming delete request ===")
    print("Body:", body)

    crop = body.get("crop")
    if not crop:
        raise HTTPException(status_code=400, detail="Crop not provided")

    # Normalize crop path
    parsed = urlparse(crop)
    req_path = unquote(parsed.path).lstrip("/")
    if req_path.startswith("data/"):
        req_path = req_path[len("data/"):]
    print("Normalized request crop:", req_path)

    # Try Mongo first
    try:
        client.admin.command("ping")
        print("✅ Using MongoDB for delete")

        result = images.update_one(
            {"detections.crop": req_path},
            {"$pull": {"detections": {"crop": req_path}}}
        )

        if result.modified_count > 0:
            updated_doc = images.find_one({"detections.crop": {"$ne": req_path}}, {"_id": 0})
            print("✅ Deleted detection in Mongo")
            return {"deleted": req_path}
        else:
            print("No match found in Mongo for:", req_path)

    except errors.PyMongoError as e:
        print("⚠️ MongoDB error:", e)

    # JSON fallback
    print("⚠️ Falling back to JSON delete")
    metadata = load_metadata()
    print("Loaded metadata items:", len(metadata))
    for item in metadata:
        detections = item.get("detections", [])
        for det in detections:
            det_crop = det.get("crop") or ""
            print(f"Comparing request [{req_path}] with stored [{det_crop}]")
            if det_crop == req_path:
                print("✅ Match found! Removing detection (JSON)...")
                # remove this detection object from the list
                item["detections"] = [d for d in detections if (d.get("crop") or "") != req_path]
                save_metadata(metadata)
                print("Detection removed and metadata saved to JSON")
                return {"deleted": req_path}

    print("No match found for:", req_path)
    raise HTTPException(status_code=404, detail=f"Detection not found for {req_path}")

# Detection Pipeline --------------------------------------------
def convert_objectid(obj):
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, list):
        return [convert_objectid(i) for i in obj]
    if isinstance(obj, dict):
        return {k: convert_objectid(v) for k, v in obj.items()}
    return obj

@app.post("/bulk-detect")
async def bulk_detect(request_data: dict):
    model_name = request_data.get("model", "best0501")
    os.makedirs(processed_dir, exist_ok=True)
    os.makedirs(crops_dir, exist_ok=True)

    logger.info(f"Starting bulk detection (model={model_name}) using version={DETECTION_VERSION}")

    # --- Load existing metadata for preserving validation statuses ---
    existing_metadata = {}
    if os.path.exists(default_metadata_file):
        try:
            with open(default_metadata_file, "r", encoding="utf-8") as f:
                file_data = json.load(f)
            for item in file_data:
                key = os.path.basename(item.get("uploaded_img", ""))
                if key:
                    existing_metadata[key] = item
        except Exception as e:
            logger.warning(f"Could not load existing metadata file: {e}")

    # --- Collect all images to process ---
    image_files = [
        f for f in os.listdir(original_dir)
        if f.lower().endswith(('.jpg', '.jpeg', '.png'))
    ]

    results = []

    for image_file in image_files:
        file_path = os.path.join(original_dir, image_file)
        try:
            image_pil = Image.open(file_path)
            if image_pil.mode != "RGB":
                image_pil = image_pil.convert("RGB")
            image_array = np.array(image_pil)

            # --- Perform inference using detector (YOLO + ViT) ---
            metadata, annotated_image = detector.predict(image_array, return_image=True)

            # --- Save annotated image ---
            annotated_filename = f"{os.path.splitext(image_file)[0]}_processed.jpg"
            annotated_path = os.path.join(processed_dir, annotated_filename)
            try:
                ann_arr = np.asarray(annotated_image)
                # Convert to RGB if detector returns BGR
                annotated_pil = Image.fromarray(ann_arr[..., ::-1])
                annotated_pil.save(annotated_path, quality=95)
            except Exception as e:
                logger.warning(f"Could not save annotated image for {image_file}: {e}")

            # --- Normalize plant type ---
            plant_pred = metadata.get("plant_type")
            plant_type_out = None
            if plant_pred:
                code = plant_pred.get("code")
                conf_val = plant_pred.get("confidence") or plant_pred.get("conf")
                if conf_val is not None:
                    if 0.0 <= conf_val <= 1.0:
                        conf_out = round(conf_val * 100, 2)
                    else:
                        conf_out = round(float(conf_val), 2)
                else:
                    conf_out = None
                plant_type_out = {"code": code, "conf": conf_out}

            # --- Normalize detections ---
            detections_out = []
            for d in metadata.get("detections", []):
                conf = d.get("conf") or d.get("confidence") or d.get("score")
                bbox = d.get("bbox")
                if bbox:
                    bbox = [float(x) for x in bbox]
                detections_out.append({
                    "id": int(d.get("id", -1)),
                    "type": d.get("type"),
                    "conf": float(round(conf, 4)) if conf is not None else None,
                    "bbox": bbox,
                    "status": d.get("status", "unvalidated"),
                    "crop": d.get("crop")
                })

            # --- Build metadata entry consistent with your schema ---
            new_entry = {
                "uploaded_img": os.path.join(DETECTION_VERSION, "original_img", image_file).replace("\\", "/"),
                "processed_img": os.path.join(DETECTION_VERSION, "processed_img", annotated_filename).replace("\\", "/"),
                "plant_type": plant_type_out,
                "detections": detections_out,
                "version": DETECTION_VERSION
            }

            # --- Preserve previous statuses ---
            existing = existing_metadata.get(image_file)
            if existing:
                old_dets = {
                    int(d.get("id", -1)): d
                    for d in existing.get("detections", [])
                }
                for det in new_entry["detections"]:
                    old = old_dets.get(det["id"])
                    if old and "status" in old:
                        det["status"] = old.get("status", det["status"])

            results.append(new_entry)

            # --- Upsert to MongoDB ---
            try:
                images.replace_one(
                    {"uploaded_img": new_entry["uploaded_img"]},
                    new_entry,
                    upsert=True
                )
            except Exception as e:
                logger.warning(f"MongoDB upsert failed for {image_file}: {e}")

        except Exception as e:
            tb = traceback.format_exc()
            logger.error(f"Failed to process {image_file}: {e}\n{tb}")
            results.append({
                "uploaded_img": os.path.join(DETECTION_VERSION, "original_img", image_file).replace("\\", "/"),
                "error": str(e)
            })

    # --- Save fallback JSON for static use ---
    try:
        save_metadata(results)
        logger.info(f"Metadata saved to: {default_metadata_file}")
    except Exception as e:
        logger.warning(f"Failed to save metadata file: {e}")

    # --- Response ---
    payload = {
        "success": True,
        "processed": len(results),
        "results": results
    }

    return JSONResponse(content=convert_objectid(payload))


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
#     # result = convert_to_yolov11(metadata_path, output_dir)
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
