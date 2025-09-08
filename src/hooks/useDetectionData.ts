import { useState, useEffect, useRef } from "react";
import { Detection, ImageData } from "../types";

// --- Fetch metadata only once ---
const fetchDetectionMetadata = async (): Promise<ImageData[]> => {
  const response = await fetch(
    `http://localhost:8000/metadata?t=${Date.now()}` // cache-bust
  );

  if (!response.ok) throw new Error("Failed to fetch metadata");

  const metadata = await response.json();

  return metadata.map((item: any) => ({
    uploaded_img: item.uploaded_img,
    processed_img: `http://localhost:8000/processed_img/${item.processed_img}`,
    defect_count: item.defect_count,
    detections: item.detections.map((det: any) => ({
      defect_id: det.defect_id,
      defect_type: det.defect_type,
      confidence: parseFloat(det.confidence), // convert to number here
      bbox: det.bbox,
      status: det.status,
      crop_path: `http://localhost:8000/${det.crop_path.replace(/\\/g, "/")}`,
      validated: det.status !== "unvalidated",
      validatedAs: undefined,
    })),
  }));
};

// Add FilterStatus type at the top
export type FilterStatus = 'all' | 'validated' | 'unvalidated';

export const useDetectionData = () => {
  // Store raw metadata outside state
  const metadataRef = useRef<ImageData[]>([]);

  // Navigation state
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentDetectionIndex, setCurrentDetectionIndex] = useState(0);

  // Only store a small "window" of data in state for performance
  const [windowData, setWindowData] = useState<ImageData[]>([]);

  const [validationResults, setValidationResults] = useState<any[]>([]);

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  // Add filtered metadata getter
  const getFilteredMetadata = () => {
    return metadataRef.current.filter(img => {
      if (filterStatus === 'all') return true;
      
      return img.detections.some(det => {
        if (filterStatus === 'validated') {
          return det.status === 'validated';
        }
        if (filterStatus === 'unvalidated') {
          return det.status === 'unvalidated';
        }
        return true;
      });
    });
  };

    // Update navigation functions
  const findNextImageWithDetections = (start: number) => {
    const filteredData = getFilteredMetadata();
    let i = start + 1;
    while (i < filteredData.length && filteredData[i].detections.length === 0) i++;
    return i < filteredData.length ? i : -1;
  };

  const findPrevImageWithDetections = (start: number) => {
    const filteredData = getFilteredMetadata();
    let i = start - 1;
    while (i >= 0 && filteredData[i].detections.length === 0) i--;
    return i >= 0 ? i : -1;
  };

  // --- Load metadata once ---
  const reloadMetadata = async () => {
    metadataRef.current = await fetchDetectionMetadata();

    // Start at the first image that actually has detections
    const firstIdx = metadataRef.current.findIndex(
      (img) => img.detections.length > 0
    );
    const startIdx = firstIdx === -1 ? 0 : firstIdx;

    setCurrentImageIndex(startIdx);
    setCurrentDetectionIndex(0);

    // Initialize window around the chosen index
    updateWindow(startIdx);
  };

  useEffect(() => {
    reloadMetadata();
  }, []);

  // --- Sliding Window Management ---
  const updateWindow = (imgIndex: number) => {
    const windowSize = 5; // keep only 5 in state
    const start = Math.max(0, imgIndex - 2);
    const end = Math.min(metadataRef.current.length, start + windowSize);

    setWindowData(metadataRef.current.slice(start, end));
  };

  // --- Getters for current image/detection ---
  const getCurrentImage = () => {
    const filteredData = getFilteredMetadata();
    return filteredData[currentImageIndex];
  };
  const getCurrentDetection = () =>
    getCurrentImage()?.detections[currentDetectionIndex];
  const getCurrentCropPath = () => getCurrentDetection()?.crop_path ?? null;

  // --- Validation ---
  const validateDetection = (
    decision: "correct" | "healthy" | "other",
    className?: string
  ) => {
    const currentImage = getCurrentImage();
    const currentDetection = getCurrentDetection();
    if (!currentDetection) return;

    // Update directly in metadataRef (no re-render storm)
    currentDetection.validated = true;
    currentDetection.validatedAs =
      decision === "other" ? className : decision;

    setValidationResults((prev) => [
      ...prev,
      {
        detectionId: currentDetection.defect_id,
        decision,
        className: decision === "other" ? className : undefined,
      },
    ]);

    // Instead of skipping whole image, advance detection-first
    moveToNext();
  };

  // --- detection-first navigation ---
  const moveToNext = () => {
    const img = getCurrentImage();
    if (!img) return;

    // Next detection in same image
    if (currentDetectionIndex < img.detections.length - 1) {
      setCurrentDetectionIndex((i) => i + 1);
      return;
    }

    // Otherwise go to next image with detections
    const nextImg = findNextImageWithDetections(currentImageIndex);
    if (nextImg !== -1) {
      setCurrentImageIndex(nextImg);
      setCurrentDetectionIndex(0);
      updateWindow(nextImg); // keep sliding window updated
    }
  };

  // --- Image-level navigation (Back/Next buttons) ---
  const moveToNextImage = () => {
    const nextImg = findNextImageWithDetections(currentImageIndex);
    if (nextImg !== -1) {
      setCurrentImageIndex(nextImg);
      setCurrentDetectionIndex(0);
      updateWindow(nextImg); // keep sliding window updated
    }
  };

  const moveToPrevImage = () => {
    const prevImg = findPrevImageWithDetections(currentImageIndex);
    if (prevImg !== -1) {
      setCurrentImageIndex(prevImg);
      setCurrentDetectionIndex(0);
      updateWindow(prevImg); // keep sliding window updated
    }
  };

  const goToImage = (index: number) => {
  if (index >= 0 && index < metadataRef.current.length) {
    setCurrentImageIndex(index);
    setCurrentDetectionIndex(0);
    updateWindow(index);
  }
};


  // --- Progress helpers ---
  const getTotalDetections = () =>
    metadataRef.current.reduce(
      (total, img) => total + img.detections.length,
      0
    );

  const getValidatedCount = () =>
    metadataRef.current.reduce(
      (total, img) =>
        total + img.detections.filter((d) => d.validated).length,
      0
    );

  const getProgress = () => {
    const total = getTotalDetections();
    const validated = getValidatedCount();
    return total > 0 ? (validated / total) * 100 : 0;
  };

  // --- total image count (global, not windowData.length) ---
  const getImageCount = () => metadataRef.current.length;

  return {
    // Expose window data (for previews if needed)
    windowData,

    // Navigation state
    currentImageIndex,
    currentDetectionIndex,

    // Current accessors
    getCurrentImage,
    getCurrentDetection,
    getCurrentCropPath,

    // Validation & results
    validateDetection,
    validationResults,

    // Helpers
    getTotalDetections,
    getValidatedCount,
    getProgress,
    getImageCount, 

    // Controls
    reloadMetadata,
    moveToNext, // detection-first
    moveToNextImage,
    moveToPrevImage,
    goToImage,
  };
};
