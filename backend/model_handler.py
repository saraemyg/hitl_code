import logging
import os
from ultralytics import YOLO
import numpy as np
import cv2

logger = logging.getLogger(__name__)

class PlantDefectDetector:
    def __init__(self, model_path: str, crop_dir: str = "processed_img"):
        self.model_path = model_path
        self.model = None 
        self.is_loaded = False
        self.crop_dir = crop_dir
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

            trim_square_margin = 20
            # trim 20px border inside the square if margin allows
            if trim_square_margin > 0:
                crop_h, crop_w = crop.shape[:2]
                if crop_h > 2 * trim_square_margin and crop_w > 2 * trim_square_margin:
                    crop = crop[
                        trim_square_margin:crop_h - trim_square_margin,
                        trim_square_margin:crop_w - trim_square_margin
                    ]

        image_id = 'crops'
        # Filename: defectType_classId_bbox.jpg //// pls fix this later TT
        save_dir = os.path.join(self.crop_dir, image_id)
        os.makedirs(save_dir, exist_ok=True)

        # Filename: defectType_classId_bbox.jpg
        filename = f"{defect_type}_{defect_id}_{x1}{y1}{x2}{y2}.jpg"
        save_path = os.path.join(save_dir, filename)

        # Save file
        cv2.imwrite(save_path, crop)

        return save_path

    def predict(self, image: np.ndarray, return_image: bool, conf_threshold: float = 0.5):
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
                    conf_str = int(conf * (10**10))

                    # Call crop_handler
                    crop_path = self.crop_handler(
                        image_bgr, x1, y1, x2, y2,
                        defect_id, defect_type
                    )

                    detection = {
                        "defect_id": defect_id,
                        "defect_type": defect_type,
                        "confidence": conf_str,
                        "bbox": box.xyxy[0].cpu().numpy().tolist(),
                        "status": "unvalidated",
                        "crop_path": crop_path
                    }
                    detections.append(detection)
            
            if return_image:
                annotated_image = result.plot(
                    conf=True,
                    labels=True,
                    boxes=True,
                    line_width=5
                )
        
        if return_image:
            return detections, annotated_image
        return detections
