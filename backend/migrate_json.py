# migrate_json.py
import json, os
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME", "hitl_db")  # fallback if missing
COLLECTION_NAME = "yolov11_v1"

default_metadata_file = "backend\data\yolov11_v1\yolov11_v1_metadata.json"


def migrate_json_to_mongo(file=default_metadata_file):
    if not os.path.exists(file):
        print("❌ JSON metadata file not found")
        return

    with open(file, "r") as f:
        metadata = json.load(f)

    if not isinstance(metadata, list):
        print("❌ Metadata must be a list of records")
        return

    # Derive collection name from file (e.g. yolov11_v1_metadata.json → images_yolov11_v1)
    base = os.path.basename(file)  # yolov11_v1_metadata.json
    name, _ = os.path.splitext(base)
    if name.endswith("_metadata"):
        name = name.replace("_metadata", "")
    collection_name = f"images_{name}"

    # Connect to Mongo
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    db = client[DB_NAME]
    collection = db[collection_name]

    if metadata:
        collection.insert_many(metadata)
        print(f"✅ Migrated {len(metadata)} documents into MongoDB collection '{collection_name}'")

if __name__ == "__main__":
    migrate_json_to_mongo()
