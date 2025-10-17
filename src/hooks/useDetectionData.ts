import { useState, useEffect, useRef } from "react";
import { ImageData } from "../types";
import { useMetadata } from "../context/MetadataContext";

// ----------------------------------------------------------------
// Utility function to safely get API base URL at runtime
// ----------------------------------------------------------------
const getApiBase = () => {
  return import.meta.env.VITE_API_URL || "http://localhost:8000";
};

// ----------------------------------------------------------------
// Fetch metadata from backend
// ----------------------------------------------------------------
export const fetchDetectionMetadata = async (
  selectedMetadata?: string // optional, fallback to default inside
): Promise<ImageData[]> => {
  const API_BASE = getApiBase();

  // --- Plant label lookup 
  const PLANT_LABELS: Record<string, string> = {
    CSBL: "Bright Lights Swiss Chard",
    KBSC: "Blue Scotch Kale",
    LBSS: "Lettuce Black Seeded Simpson",
    MBBC: "Baby Bok Choy",
    MGMZ: "Green Mizuna",
    RSLD: "Rocket Arugula",
  };

  const metadataFile = selectedMetadata
    ? `data/${selectedMetadata}`
    : "data/detection_v1/detection_v1_metadata.json";

  let response: Response;

  try {
    response = await fetch(`${API_BASE}/metadata?file=${metadataFile}&t=${Date.now()}`);
    if (!response.ok) throw new Error("Fetch failed");
  } catch (err) {
    console.warn(`⚠️ Failed to load ${metadataFile}, falling back to detection_v1`, err);
    response = await fetch(
      `${API_BASE}/metadata?file=detection_v1/detection_v1_metadata.json&t=${Date.now()}`
    );
    if (!response.ok) throw new Error("Failed to fetch detection_v1 metadata");
  }

  const metadata = await response.json();

  // --- Normalize + enrich data for UI ---
  return metadata.map((item: any) => {
    const plantType = item.plant_type || {};
    const code = plantType.code || null;
    const conf = plantType.conf || null;

    // If code exists, show readable label
    const readableLabel = code && PLANT_LABELS[code] ? PLANT_LABELS[code] : code;

    return {
      uploaded_img: `${API_BASE}/${item.uploaded_img}`,
      processed_img: `${API_BASE}/${item.processed_img}`,
      defect_count: item.defect_count,
      plant_type: {
        code,                    // stored code (MBBC, etc.)
        label: readableLabel,    // UI label (Baby Bok Choy)
        conf,                    // confidence from ViT
      },
      detections: item.detections.map((det: any) => ({
        id: det.id,
        type: det.type,
        conf: parseFloat(det.conf),
        bbox: det.bbox,
        status: det.status,
        crop: det.crop ? `${API_BASE}/${det.crop}` : null,
        validated: det.status !== "unvalidated",
        validatedAs: det.status === "unvalidated" ? undefined : det.status,
      })),
    };
  });
};

// Filter type
export type FilterStatus = "all" | "validated" | "unvalidated" | "uncertain" | "healthy";

// Hook -------------------------------------------------------

export const useDetectionData = () => {
  const { selectedMetadata } = useMetadata(); 

  // Store raw metadata outside state to avoid unnecessary re-renders
  const metadataRef = useRef<ImageData[]>([]);

  // Navigation state
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentDetectionIndex, setCurrentDetectionIndex] = useState(0);

  // Small "window" of data in state for performance UI efficiency
  const [windowData, setWindowData] = useState<ImageData[]>([]);

  // Track validation results
  const [validationResults, setValidationResults] = useState<any[]>([]);

  // Filter control (used only for UI)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<ImageData[]>([]); // store loaded metadata

  // Helpers -----------------------------------------------------

  // Filter helper get filtered metadata for UI (thumbnails, progress)
  const getFilteredMetadata = () => {
    return metadataRef.current.filter((img) => {
      if (filterStatus === "all") return true;
      return img.detections.some((det) => {
        if (filterStatus === "validated") return det.status === "validated";
        if (filterStatus === "unvalidated") return det.status === "unvalidated";
        return true;
      });
    });
  };

  // --- Sliding window for performance
  const updateWindow = (imgIndex: number) => {
    const windowSize = 5;
    const start = Math.max(0, imgIndex - 2);
    const end = Math.min(metadataRef.current.length, start + windowSize);
    setWindowData(metadataRef.current.slice(start, end));
  };

  // Accessors using full metadata (prevents jumping on validation)
  const getCurrentDetection = () => getCurrentImage()?.detections[currentDetectionIndex];
  const getCurrentCropPath = () => getCurrentDetection()?.crop ?? null;
  const getCurrentImage = () => {
    const filteredData = getFilteredMetadata();
    return filteredData[currentImageIndex];
  };

  // Metadata ------------------------------------------------
  const reloadMetadata = async () => {
    setLoading(true);
    setError(null);
    try {
      const newMetadata = await fetchDetectionMetadata(selectedMetadata);
      metadataRef.current = newMetadata;
      setData(newMetadata); // keep copy for read-only access
      updateWindow(currentImageIndex);
    } catch (err: any) {
      console.error("Failed to reload metadata:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  // Auto reload on metadata change
  useEffect(() => {
    if (selectedMetadata) reloadMetadata();
  }, [selectedMetadata]);

  // Navigation -----------------------------------------
  
  // Detection Navigation
  const goNextDetection = () => {
    const img = getCurrentImage();
    if (!img) return;
    if (currentDetectionIndex < img.detections.length - 1) {
      setCurrentDetectionIndex((i) => i + 1);
    }
  };

  const goPrevDetection = () => {
    if (currentDetectionIndex > 0) setCurrentDetectionIndex((i) => i - 1);
  };

  const goToDetection = (index: number) => {
    const img = getCurrentImage();
    if (!img) return;
    if (index >= 0 && index < img.detections.length) setCurrentDetectionIndex(index);
  };

  // Image navigation
  const goNextImage = () => {
    const nextIdx = Math.min(currentImageIndex + 1, metadataRef.current.length - 1);
    setCurrentImageIndex(nextIdx);
    setCurrentDetectionIndex(0);
    updateWindow(nextIdx);
  };

  const goPrevImage = () => {
    const prevIdx = Math.max(currentImageIndex - 1, 0);
    setCurrentImageIndex(prevIdx);
    setCurrentDetectionIndex(0);
    updateWindow(prevIdx);
  };

  const goToImage = (index: number) => {
    if (index >= 0 && index < metadataRef.current.length) {
      setCurrentImageIndex(index);
      setCurrentDetectionIndex(0);
      updateWindow(index);
    }
  };

  // Validation ----------------------------------------------
 
  const validateDetection = (
    decision: "correct" | "healthy" | "other" | "uncertain",
    className?: string
  ) => {
    const detection = getCurrentDetection();
    if (!detection) return;

    detection.validated = true;
    detection.validatedAs = decision === "other" ? className : decision;

    setValidationResults((prev) => [
      ...prev,
      { detectionId: detection.id, decision, className: decision === "other" ? className : undefined },
    ]);
  };

  // Progress --------------------------------------------

  const getTotalDetections = () =>
    metadataRef.current.reduce((total, img) => total + img.detections.length, 0);

  const getValidatedCount = () =>
    metadataRef.current.reduce((total, img) => total + img.detections.filter((d) => d.validated).length, 0);

  const getProgress = () => {
    const total = getTotalDetections();
    const validated = getValidatedCount();
    return total > 0 ? (validated / total) * 100 : 0;
  };

  const getImageCount = () => metadataRef.current.length;

  return {

    data,
    loading,
    error,
    
    windowData,
    currentImageIndex,
    currentDetectionIndex,

    getCurrentImage,
    getCurrentDetection,
    getCurrentCropPath,

    validateDetection,
    validationResults,

    getTotalDetections,
    getValidatedCount,
    getProgress,
    getImageCount,

    reloadMetadata,
    goNextDetection,
    goPrevDetection,
    goToDetection,
    goNextImage,
    goPrevImage,
    goToImage,
  };
};
