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
