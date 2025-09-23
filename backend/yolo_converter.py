import json
import os
import shutil
import cv2

def convert_to_yolov11(metadata_path: str, output_dir: str):
    # Define subfolders for YOLOv11 structure
    train_img_dir = os.path.join(output_dir, "train/images")
    train_lbl_dir = os.path.join(output_dir, "train/labels")
    valid_img_dir = os.path.join(output_dir, "valid/images")
    valid_lbl_dir = os.path.join(output_dir, "valid/labels")
    test_img_dir = os.path.join(output_dir, "test/images")
    test_lbl_dir = os.path.join(output_dir, "test/labels")

    # Make directories
    for d in [train_img_dir, train_lbl_dir, valid_img_dir, valid_lbl_dir, test_img_dir, test_lbl_dir]:
        os.makedirs(d, exist_ok=True)

    # Load metadata
    with open(metadata_path, "r") as f:
        metadata = json.load(f)

    total = len(metadata)
    train_end = int(total * 1.0)

    for idx, item in enumerate(metadata):
        image_name = item["uploaded_img"]
        detections = item.get("detections", [])

        # Path to input image
        src_img_path = os.path.join("uploaded_img", image_name)
        if not os.path.exists(src_img_path):
            continue  # skip missing images

        # Deterministic split by index
        if idx < train_end:
            img_out_dir, lbl_out_dir = train_img_dir, train_lbl_dir

        # Copy image
        dst_img_path = os.path.join(img_out_dir, image_name)
        shutil.copy(src_img_path, dst_img_path)

        # Get image size for normalization
        img = cv2.imread(src_img_path)
        h, w, _ = img.shape

        # Write YOLOv11 label file
        label_path = os.path.join(lbl_out_dir, os.path.splitext(image_name)[0] + ".txt")
        with open(label_path, "w") as lf:
            for det in detections:
                cls = det["defect_id"]
                x1, y1, x2, y2 = det["bbox"]  # assuming absolute coords
                # Normalize
                xc = ((x1 + x2) / 2) / w
                yc = ((y1 + y2) / 2) / h
                bw = (x2 - x1) / w
                bh = (y2 - y1) / h
                lf.write(f"{cls} {xc:.6f} {yc:.6f} {bw:.6f} {bh:.6f}\n")

    # Write data.yaml file
    yaml_content = """train: ../train/images
val: ../valid/images
test: ../test/images

nc: 7
names: ['BrownSpot', 'Browning', 'BurnedTip', 'Curling', 'Purpling', 'Wilting', 'Yellowing']

roboflow:
  workspace: planthealthml
  project: plantdefecttest
  version: 3
  license: CC BY 4.0
  url: https://universe.roboflow.com/planthealthml/plantdefecttest/dataset/3
"""
    yaml_path = os.path.join(output_dir, "data.yaml")
    with open(yaml_path, "w") as f:
        f.write(yaml_content)

    return {"status": "success", "output_dir": output_dir, "yaml": yaml_path}

yolo_dir = os.path.join("all-v3")

metadata_path = os.path.join("metadata", "detection_metadata.json")

def convert_yolov11_to_metadata(yolo_dir: str, output_metadata_path: str = "metadata/yolov11_metadata.json"):
    import glob

    # Class mapping (must match your data.yaml order)
    defect_classes = [
        'BrownSpot', 'Browning', 'BurnedTip',
        'Curling', 'Purpling', 'Wilting', 'Yellowing'
    ]

    all_metadata = []

    # Iterate over train/valid/test splits
    for split in ["train", "valid", "test"]:
        label_dir = os.path.join(yolo_dir, split, "labels")
        image_dir = os.path.join(yolo_dir, split, "images")

        for label_file in glob.glob(os.path.join(label_dir, "*.txt")):
            image_name = os.path.basename(label_file).replace(".txt", "")
            img_path = os.path.join(image_dir, image_name + ".jpg")

            if not os.path.exists(img_path):
                # Try jpeg, png etc.
                exts = [".jpeg", ".png", ".JPEG", ".JPG",".heic"]
                found = False
                for ext in exts:
                    alt_path = os.path.join(image_dir, image_name + ext)
                    if os.path.exists(alt_path):
                        img_path = alt_path
                        found = True
                        break
                if not found:
                    continue  # skip missing image

            img = cv2.imread(img_path)
            if img is None:
                continue
            h, w, _ = img.shape

            detections = []
            with open(label_file, "r") as f:
                for line in f:
                    parts = line.strip().split()
                    if len(parts) != 5:
                        continue
                    cls_id, xc, yc, bw, bh = map(float, parts)
                    cls_id = int(cls_id)

                    # Convert back to absolute bbox
                    xc_abs, yc_abs = xc * w, yc * h
                    bw_abs, bh_abs = bw * w, bh * h
                    x1 = xc_abs - bw_abs / 2
                    y1 = yc_abs - bh_abs / 2
                    x2 = xc_abs + bw_abs / 2
                    y2 = yc_abs + bh_abs / 2

                    detections.append({
                        "defect_id": cls_id,
                        "defect_type": defect_classes[cls_id],
                        "confidence": None,
                        "bbox": [x1, y1, x2, y2],
                        "status": "unvalidated",
                        "crop_path": None
                    })

            all_metadata.append({
                "uploaded_img": os.path.basename(img_path),
                "processed_img": os.path.basename(img_path),
                "detections": detections
            })

    # Ensure metadata folder exists
    os.makedirs(os.path.dirname(output_metadata_path), exist_ok=True)

    with open(output_metadata_path, "w") as f:
        json.dump(all_metadata, f, indent=2)

    return {"status": "success", "metadata_file": output_metadata_path}
