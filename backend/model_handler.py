import logging
import os
from ultralytics import YOLO
import numpy as np
import cv2

logger = logging.getLogger(__name__)

class PlantDefectDetector:
    def __init__(self, model_path: str, base_dir: str = "data", version: str = "detection_v1"):
        self.model_path = model_path
        self.model = None 
        self.is_loaded = False

        # Folder structure
        self.version = version
        self.base_dir = base_dir
        self.crop_dir = os.path.join(base_dir, version, "crops")
        os.makedirs(self.crop_dir, exist_ok=True)
    
    def load_model(self):
        try:
            logger.info(f"Loading model from {self.model_path}")
            self.model = YOLO(self.model_path)
            self.is_loaded = True
            logger.info("Model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise

    def _iou(self, boxA, boxB):
        # Compute IoU between two bounding boxes.
        xA = max(boxA[0], boxB[0])
        yA = max(boxA[1], boxB[1])
        xB = min(boxA[2], boxB[2])
        yB = min(boxA[3], boxB[3])

        interW = max(0, xB - xA)
        interH = max(0, yB - yA)
        interArea = interW * interH

        boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
        boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])
        unionArea = boxAArea + boxBArea - interArea

        return interArea / unionArea if unionArea > 0 else 0


    def crop_handler(self, image_bgr, x1, y1, x2, y2, defect_id, defect_type, padding=100, make_square=True):
        #Handles cropping, padding, and saving defect crop 
        h, w = image_bgr.shape[:2]

        # Add padding but keep inside image boundaries
        x1 = max(0, x1 - padding)
        y1 = max(0, y1 - padding)
        x2 = min(w, x2 + padding)
        y2 = min(h, y2 + padding)

        # Crop
        crop = image_bgr[y1:y2, x1:x2]
        
        # Make crop square if requested
        if make_square:
            crop_h, crop_w = crop.shape[:2]
            if crop_h != crop_w:
                size = min(crop_h, crop_w)  # keep smaller dimension
                y_center, x_center = crop_h // 2, crop_w // 2
                half = size // 2

                # crop to centered square
                x1_sq = max(0, x_center - half)
                x2_sq = x1_sq + size
                y1_sq = max(0, y_center - half)
                y2_sq = y1_sq + size
                crop = crop[y1_sq:y2_sq, x1_sq:x2_sq]
            # trim 20px border inside the square if margin allows
            trim_square_margin = 20
            if trim_square_margin > 0:
                crop_h, crop_w = crop.shape[:2]
                if crop_h > 2 * trim_square_margin and crop_w > 2 * trim_square_margin:
                    crop = crop[
                        trim_square_margin:crop_h - trim_square_margin,
                        trim_square_margin:crop_w - trim_square_margin
                    ]

        # Save crop into crops/ folder
        filename = f"{defect_type}_{x1}{y1}{x2}{y2}.jpg"
        save_path = os.path.join(self.crop_dir, filename)
        cv2.imwrite(save_path, crop)

        # relative path for metadata (URL-safe)
        rel_path = os.path.relpath(save_path, "data")
        return rel_path.replace("\\", "/")  # forward slashes

    def predict(self, image: np.ndarray, return_image: bool, conf_threshold: float = 0.05):
        if not self.is_loaded:
            raise Exception("Model not loaded")

        image_bgr = image[..., ::-1] # Convert RGB → BGR for OpenCV
        results = self.model(image_bgr, conf=conf_threshold)

        detections = []
        annotated_image = None

        for result in results:
            logger.info(result)
            if result.boxes is not None:
                for box in result.boxes:
                    defect_id = int(box.cls[0])
                    defect_type = result.names[defect_id]
                    x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
                    conf = float(box.conf[0])
                    bbox = [x1, y1, x2, y2]

                    # NMS suppression: skip if overlaps ≥80% with existing same-type box
                    skip = False
                    for d in detections:
                        if d["type"] == defect_type:
                            iou = self._iou(bbox, d["bbox"])
                            if iou >= 0.8:
                                skip = True
                                break
                    if skip:
                        continue


                    # Call crop_handler
                    crop_path = self.crop_handler(
                        image_bgr, x1, y1, x2, y2,
                        defect_id, defect_type
                    )

                    detection = {
                        "id": defect_id,
                        "type": defect_type,
                        "conf": round(conf, 4),
                        "bbox": box.xyxy[0].cpu().numpy().tolist(),
                        "status": "unvalidated",
                        "crop": crop_path
                    }
                    detections.append(detection)
            
            if return_image:
                annotated_image = result.plot(
                    conf=True,
                    labels=True,
                    boxes=True,
                    line_width=5
                )
        
        return (detections, annotated_image) if return_image else detections
