import { useState, useEffect } from 'react';
import { Detection, ImageData } from '../types';

const fetchDetectionMetadata = async (): Promise<ImageData[]> => {
  // Fetch metadata from backend
  const response = await fetch('http://localhost:8000/outputs/bulk_detection_metadata.json');
  const metadata = await response.json();

  // Transform backend metadata to ImageData[]
  return metadata.map((item: any) => ({
    path: `http://localhost:8000/outputs/${item.output_image}`,
    name: item.input_image,
    detections: item.detections.map((det: any, idx: number) => ({
      id: `${item.input_image}-${idx}`,
      bbox: det.bbox,
      confidence: det.confidence,
      className: det.defect_type,
      validated: false,
    })),
    processed: true,
  }));
};

export const useDetectionData = () => {
  const [imageData, setImageData] = useState<ImageData[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentDetectionIndex, setCurrentDetectionIndex] = useState(0);
  const [validationResults, setValidationResults] = useState<any[]>([]);

  useEffect(() => {
    // Fetch detection metadata from backend
    fetchDetectionMetadata().then(setImageData);
  }, []);

  const getCurrentImage = () => imageData[currentImageIndex];
  const getCurrentDetection = () => {
    const currentImage = getCurrentImage();
    return currentImage?.detections[currentDetectionIndex];
  };

  const validateDetection = (decision: 'correct' | 'healthy' | 'other', className?: string) => {
    const currentDetection = getCurrentDetection();
    if (!currentDetection) return;

    setImageData(prev => {
      const updated = [...prev];
      updated[currentImageIndex].detections[currentDetectionIndex] = {
        ...currentDetection,
        validated: true,
        validatedAs: decision === 'other' ? className : decision
      };
      return updated;
    });

    setValidationResults(prev => [...prev, {
      detectionId: currentDetection.id,
      decision,
      className: decision === 'other' ? className : undefined
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

  const getTotalDetections = () => {
    return imageData.reduce((total, image) => total + image.detections.length, 0);
  };

  const getValidatedCount = () => {
    return imageData.reduce((total, image) => 
      total + image.detections.filter(d => d.validated).length, 0
    );
  };

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
    validateDetection,
    getTotalDetections,
    getValidatedCount,
    getProgress,
    validationResults
  };
};