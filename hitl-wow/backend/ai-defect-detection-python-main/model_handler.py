import logging
from ultralytics import YOLO
import numpy as np

logger = logging.getLogger(__name__)

class PlantDefectDetector:
    def __init__(self, model_path: str):
        self.model_path = model_path
        self.model = None 
        self.is_loaded = False
    
    def load_model(self):
        try:
            logger.info(f"Loading model from {self.model_path}")
            self.model = YOLO(self.model_path)
            self.is_loaded = True
            logger.info("Model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise
    
    def predict(self, image: np.ndarray, return_image: bool, conf_threshold: float = 0.1):
        if not self.is_loaded:
            raise Exception("Model not loaded")
        
        image_bgr = image[..., ::-1]

        results = self.model(image_bgr, conf=conf_threshold)

        detections = []
        annotated_image = None

        for result in results:
            if result.boxes is not None:
                for box in result.boxes:
                    detection = {
                        "defect_type": result.names[int(box.cls[0])],
                        "confidence": float(box.conf[0]),
                        "bbox": box.xyxy[0].cpu().numpy().tolist()
                    }
                    detections.append(detection)
            
            if return_image:
                annotated_image = result.plot(
                    conf=True,
                    labels=True,
                    boxes=True,
                    line_width=2
                )
        
        if return_image:
            return detections, annotated_image
        return detections