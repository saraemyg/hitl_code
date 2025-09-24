import json
import os
import cv2

# Input COCO-like JSON file
input_json = "metadata/all_v3_dataset.json"
# Output metadata file in your HITL format
output_json = "metadata/yolov11_metadata.json"

# Class mapping (ensure it matches your classes)
defect_classes = [
    'BrownSpot', 'Browning', 'BurnedTip',
    'Curling', 'Purpling', 'Wilting', 'Yellowing'
]

# Folder for processed crops (used in crop path)
crop_dir = "processed_img/crops"

os.makedirs(crop_dir, exist_ok=True)

with open(input_json, "r") as f:
    data = json.load(f)

all_metadata = []

for img_name, img_info in data.items():
    width = img_info["width"]
    height = img_info["height"]
    annotations = img_info.get("annotations", [])

    detections = []
    for idx, ann in enumerate(annotations):
        cls_id = ann["class_id"]
        xc, yc, bw, bh = ann["bbox"]

        # Convert normalized to absolute coordinates
        x1 = int((xc - bw / 2) * width)
        y1 = int((yc - bh / 2) * height)
        x2 = int((xc + bw / 2) * width)
        y2 = int((yc + bh / 2) * height)

        # Generate unique crop path
        crop_name = f"{defect_classes[cls_id]}_{idx}_{str(hash(img_name + str(idx)) % 10**16)}.jpg"
        crop_path = os.path.join(crop_dir, crop_name).replace("/", "\\")

        detections.append({
            "id": idx,
            "type": defect_classes[cls_id],
            "conf": None,
            "bbox": [x1, y1, x2, y2],
            "status": "unvalidated",
            "crop": crop_path
        })

    all_metadata.append({
        "uploaded_img": img_name,
        "processed_img": img_name.replace(".jpg", "_processed.jpg").replace(".jpeg", "_processed.jpg"),
        "detections": detections
    })

# Save converted metadata
os.makedirs(os.path.dirname(output_json), exist_ok=True)
with open(output_json, "w") as f:
    json.dump(all_metadata, f, indent=2)

print(f"Metadata conversion done. Saved to {output_json}")
