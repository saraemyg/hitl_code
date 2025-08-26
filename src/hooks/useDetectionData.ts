import { useState, useEffect } from 'react';
import { Detection, ImageData } from '../types';

const fetchDetectionMetadata = async (): Promise<ImageData[]> => {
  const response = await fetch(
    `http://localhost:8000/metadata?t=${Date.now()}` // cache-bust
  );

  if (!response.ok) {
    throw new Error("Failed to fetch metadata");
  }

  const metadata = await response.json();

  return metadata.map((item: any) => ({
    uploaded_img: item.uploaded_img,
    processed_img: `http://localhost:8000/processed_img/${item.processed_img}`,
    defect_count: item.defect_count,

    detections: item.detections.map((det: any) => ({
      defect_id: det.defect_id,
      defect_type: det.defect_type,
      confidence: det.confidence, // backend sends as string
      bbox: det.bbox,
      status: det.status,
      crop_path: `http://localhost:8000/${det.crop_path.replace(/\\/g, "/")}`,

      // frontend-only state (not in backend)
      validated: det.status !== "unvalidated",
      validatedAs: undefined,
    })),
  }));
};

export const useDetectionData = () => {
  const [imageData, setImageData] = useState<ImageData[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentDetectionIndex, setCurrentDetectionIndex] = useState(0);
  const [validationResults, setValidationResults] = useState<any[]>([]);

  const reloadMetadata = async () => {
    setImageData([]);
    setCurrentImageIndex(0);
    setCurrentDetectionIndex(0);
    setValidationResults([]);

    const freshMetadata = await fetchDetectionMetadata();
    setImageData(freshMetadata);
  };

  useEffect(() => {
    reloadMetadata();
  }, []);

  const getCurrentImage = () => imageData[currentImageIndex];
  const getCurrentDetection = () => getCurrentImage()?.detections[currentDetectionIndex];
  const getCurrentCropPath = () => getCurrentDetection()?.crop_path ?? null;

  const validateDetection = (decision: 'correct' | 'healthy' | 'other', className?: string) => {
    const currentDetection = getCurrentDetection();
    if (!currentDetection) return;

    setImageData(prev => {
      const updated = [...prev];
      updated[currentImageIndex].detections[currentDetectionIndex] = {
        ...currentDetection,
        validated: true,
        validatedAs: decision === 'other' ? className : decision,
      };
      return updated;
    });

    setValidationResults(prev => [...prev, {
      detectionId: currentDetection.confidence,
      decision,
      className: decision === 'other' ? className : undefined,
    }]);

    moveToNext();
  };

  const moveToNext = () => {
    const currentImage = getCurrentImage();
    if (!currentImage) return;

    if (currentDetectionIndex < currentImage.detections.length - 1) {
      setCurrentDetectionIndex(prev => prev + 1);
    } else if (currentImageIndex < imageData.length - 1) {
      setCurrentImageIndex(prev => prev + 1);
      setCurrentDetectionIndex(0);
    }
  };

  // --- Progress helpers ---
  const getTotalDetections = () =>
    imageData.reduce((total, img) => total + img.detections.length, 0);

  const getValidatedCount = () =>
    imageData.reduce((total, img) => total + img.detections.filter(d => d.validated).length, 0);

  const getProgress = () => {
    const total = getTotalDetections();
    const validated = getValidatedCount();
    return total > 0 ? (validated / total) * 100 : 0;
  };

  return {
    imageData,
    currentImageIndex,
    currentDetectionIndex,
    getCurrentImage,
    getCurrentDetection,
    getCurrentCropPath,
    validateDetection,
    getTotalDetections,
    getValidatedCount,
    getProgress,
    validationResults,
    reloadMetadata, // expose reload so frontend can trigger refresh
  };
};
