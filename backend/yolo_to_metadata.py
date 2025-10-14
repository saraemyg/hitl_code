import os
import json
import cv2
import shutil

class CropHandler:
    def __init__(self, crop_dir):
        self.crop_dir = crop_dir
        os.makedirs(self.crop_dir, exist_ok=True)

    def crop_handler(self, image_bgr, x1, y1, x2, y2, defect_id, defect_type, padding=100, make_square=True):
        h, w = image_bgr.shape[:2]

        x1 = max(0, int(x1 - padding))
        y1 = max(0, int(y1 - padding))
        x2 = min(w, int(x2 + padding))
        y2 = min(h, int(y2 + padding))

        crop = image_bgr[y1:y2, x1:x2]

        if make_square:
            crop_h, crop_w = crop.shape[:2]
            if crop_h != crop_w:
                size = min(crop_h, crop_w)
                y_center, x_center = crop_h // 2, crop_w // 2
                half = size // 2
                crop = crop[
                    max(0, y_center - half):y_center + half,
                    max(0, x_center - half):x_center + half
                ]

            trim_square_margin = 20
            crop_h, crop_w = crop.shape[:2]
            if crop_h > 2 * trim_square_margin and crop_w > 2 * trim_square_margin:
                crop = crop[
                    trim_square_margin:crop_h - trim_square_margin,
                    trim_square_margin:crop_w - trim_square_margin
                ]

        filename = f"{defect_type}_{x1}{y1}{x2}{y2}.jpg"
        save_path = os.path.join(self.crop_dir, filename)
        cv2.imwrite(save_path, crop)

        rel_path = os.path.relpath(save_path, "backend/data")
        return rel_path.replace("\\", "/")


def convert_yolo_to_metadata(yolo_dir, output_file, version="v1"):
    metadata_list = []
    subsets = ["train", "valid", "test"]

    class_map = {
        0: "BrownSpot",
        1: "Browning",
        2: "BurnedTip",
        3: "Curling",
        4: "Purpling",
        5: "Wilting",
        6: "Yellowing"
    }

    # Base dir inside backend/data
    full_version = f"yolov11_{version}"
    base_dir = os.path.join("backend/data", full_version)
    crop_dir = os.path.join(base_dir, "crops")
    orig_dir = os.path.join(base_dir, "original_img")

    os.makedirs(crop_dir, exist_ok=True)
    os.makedirs(orig_dir, exist_ok=True)

    crop_handler = CropHandler(crop_dir)

    for subset in subsets:
        subset_path = os.path.join(yolo_dir, subset)
        if not os.path.exists(subset_path):
            print(f"⚠️ Skipping {subset} (not found)")
            continue

        labels_path = os.path.join(subset_path, "labels")
        images_path = os.path.join(subset_path, "images")

        if not os.path.exists(labels_path) or not os.path.exists(images_path):
            print(f"⚠️ Skipping {subset} (missing labels/images)")
            continue

        print(f"🔄 Processing {subset}...")
        for i, label_file in enumerate(os.listdir(labels_path)):
            if not label_file.endswith(".txt"):
                continue

            img_file = os.path.splitext(label_file)[0] + ".jpg"
            img_path = os.path.join(images_path, img_file)
            label_path = os.path.join(labels_path, label_file)

            if not os.path.exists(img_path):
                continue

            img = cv2.imread(img_path)
            if img is None:
                continue
            height, width, _ = img.shape

            # Copy image to original_img folder
            dest_img_path = os.path.join(orig_dir, img_file)
            if not os.path.exists(dest_img_path):
                shutil.copy(img_path, dest_img_path)

            detections = []
            with open(label_path, "r") as f:
                for line in f:
                    parts = line.strip().split()
                    if len(parts) < 5:
                        continue

                    cls, x, y, w, h = map(float, parts[:5])
                    conf = float(parts[5]) if len(parts) >= 6 else 1.0

                    x1 = (x - w/2) * width
                    y1 = (y - h/2) * height
                    x2 = (x + w/2) * width
                    y2 = (y + h/2) * height

                    cls_int = int(cls)
                    defect_type = class_map.get(cls_int, f"Class{cls_int}")
                    crop_path = crop_handler.crop_handler(img, x1, y1, x2, y2, cls_int, defect_type)

                    detections.append({
                        "id": cls_int,
                        "type": defect_type,
                        "conf": round(conf, 4),
                        "bbox": [x1, y1, x2, y2],
                        "status": "unvalidated",
                        "crop": crop_path
                    })

            # Both uploaded_img & processed_img point to the same file in original_img
            rel_img_path = os.path.relpath(dest_img_path, "backend/data").replace("\\", "/")

            metadata_entry = {
                "uploaded_img": rel_img_path,
                "processed_img": rel_img_path,
                "detections": detections,
                "defect_count": len(detections)
            }
            metadata_list.append(metadata_entry)

            if len(metadata_list) <= 5:
                print(json.dumps(metadata_entry, indent=2))

            if (i + 1) % 500 == 0:
                print(f"✅ Processed {i+1} files in {subset}...")

    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, "w") as f:
        json.dump(metadata_list, f, indent=2)
    print(f"\n🎉 Metadata saved to {output_file}")


if __name__ == "__main__":
    # Hardcoded paths
    yolo_dir = "backend/all_v3"
    output_file = "backend/data/yolov11_v1/yolov11_v1_metadata.json"
    version = "v1"

    convert_yolo_to_metadata(yolo_dir, output_file, version)
