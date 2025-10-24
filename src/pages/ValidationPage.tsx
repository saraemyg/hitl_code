// src/pages/ValidationPage.tsx
import React, { useState, useEffect } from "react";
import { SkipForward, SkipBack, Filter, Layout, ChevronLeft, ChevronRight, Check, Heart, HelpCircle,} from "lucide-react"; 
import { useDetectionData } from "../hooks/useDetectionData";
import { Detection } from "../types";
import { ImageViewer } from "../components/ImageViewer";
import { ValidationControls } from "../components/ValidationControls";
import { ProgressBar } from "../components/ProgressBar";
import InfoPanel from "../components/InfoPanel";
import AnnotationPage from "./AnnotationPage";

import { useConfidence } from "../context/ConfidenceContext"; 

export const ValidationPage: React.FC = () => {
  const {
    getCurrentImage,
    getCurrentDetection, 
    validateDetection,
    getTotalDetections,
    getValidatedCount,
    getProgress,
    goNextDetection,
    goPrevDetection,
    goToDetection,
    goNextImage,
    goPrevImage,
    goToImage,
    getImageCount,
    reloadMetadata,
    currentImageIndex,
    windowData,
  } = useDetectionData();
  
  // ===== Placeholder objects in case no data is loaded =====
  const PLACEHOLDER_IMAGE = {
    name: "placeholder.jpg",
    path: "https://i.pinimg.com/736x/d4/71/c4/d471c4befa7ec4053d9eaf8e1034b870.jpg",
  };
  const PLACEHOLDER_DETECTION: Detection = {
    id: 0,
    type: "x",
    conf: 0,
    bbox: [0, 0, 0, 0],
    status: "placeholder",
    crop: PLACEHOLDER_IMAGE.path,
  };
  const isUsingPlaceholder = windowData.length === 0;

  // Local UI states 
  const [cacheBust, setCacheBust] = useState(Date.now());
  const [jumpIndex, setJumpIndex] = useState<number | "">("");
  const [showAltView, setShowAltView] = useState(false);

  useEffect(() => { setCacheBust(Date.now()); }, [windowData, currentImageIndex]);
  const currentImage = getCurrentImage();
  const currentDetection = getCurrentDetection() || PLACEHOLDER_DETECTION; // Use hook getter
  const detections = currentImage?.detections ?? [PLACEHOLDER_DETECTION];

 // ===== Navigator component for detections =====
  const Navigator: React.FC = () => {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const itemRefs = React.useRef<(HTMLDivElement | null)[]>([]);
    const scrollPosRef = React.useRef(0);
    const batchSize = 10;

    // --- preserve scroll across reloadMetadata
    React.useEffect(() => {
      if (containerRef.current) {
        containerRef.current.scrollLeft = scrollPosRef.current;
      }
    }, [detections]); // whenever reload changes detections

    // --- scroll to batch & ensure visibility
    const scrollToBatch = (index: number) => {
      const container = containerRef.current;
      if (!container) return;

      const batchIndex = Math.floor(index / batchSize);
      const firstItemIndex = batchIndex * batchSize;
      const firstItem = itemRefs.current[firstItemIndex];

      if (firstItem) {
        container.scrollTo({
          left: firstItem.offsetLeft,
          behavior: "smooth",
        });
      }

      // ensure current item is fully visible (in case it's clipped)
      const el = itemRefs.current[index];
      if (el) {
        el.scrollIntoView({
          behavior: "smooth",
          inline: "nearest",
          block: "nearest",
        });
      }
    };

    // --- handle detection change
    React.useEffect(() => {
      const idx = detections.indexOf(currentDetection);
      if (idx !== -1) {
        scrollToBatch(idx);
      }
    }, [currentDetection, detections]);

    // --- before reloadMetadata, save scroll
    const handleReload = async () => {
      if (containerRef.current) {
        scrollPosRef.current = containerRef.current.scrollLeft;
      }
      await reloadMetadata();
    };

    // --- keyboard shortcuts
    React.useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key.toLowerCase() === "a") goPrevDetection();
        else if (e.key.toLowerCase() === "d") goNextDetection();
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [goPrevDetection, goNextDetection]);

    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            scrollPosRef.current = containerRef.current?.scrollLeft || 0;
            goPrevDetection();
          }}
          disabled={
            currentDetection.status === "placeholder" ||
            currentImage?.detections.length === 0 ||
            currentDetection === detections[0]
          }
          className="px-3 py-2 bg-gray-200 rounded-lg disabled:opacity-50 flex items-center gap-1"
        >
          <ChevronLeft size={16} />
        </button>

        <div
          ref={containerRef}
          className="flex gap-2 overflow-x-auto scroll-smooth"
        >
          {detections.map((det, idx) => {
            let statusBorder = "border-transparent";
            if (det.status === "validated") statusBorder = "border-green-500";
            else if (det.status === "healthy") statusBorder = "border-blue-500";
            else if (det.status === "uncertain") statusBorder = "border-yellow-500";

            const isCurrent = det === currentDetection;

            return (
              <div
                key={`${currentImage?.uploaded_img || "img"}-${det.id}-${idx}`}
                ref={(el) => (itemRefs.current[idx] = el)}
                onClick={() => {
                  scrollPosRef.current = containerRef.current?.scrollLeft || 0;
                  goToDetection(idx);
                }}
                className={`w-16 h-16 flex-shrink-0 rounded overflow-hidden border-2 cursor-pointer relative ${
                  isCurrent
                    ? "ring-2 ring-offset-2 ring-gray-600"
                    : statusBorder
                }`}
              >
                <img
                  src={det.crop}
                  alt={`Detection ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            );
          })}
        </div>

        <button
          onClick={() => {
            scrollPosRef.current = containerRef.current?.scrollLeft || 0;
            goNextDetection();
          }}
          disabled={
            currentDetection.status === "placeholder" ||
            currentImage?.detections.length === 0 ||
            currentDetection === detections[detections.length - 1]
          }
          className="px-3 py-2 bg-gray-200 rounded-lg disabled:opacity-50 flex items-center gap-1"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    );
  };

  const AltMainContent: React.FC = () => (
    <div className="max-w-8xl mx-auto grid grid-cols-1 gap-3">
      <AnnotationPage
        currentImage={currentImage}
        currentDetection={currentDetection}
      />
    </div>
  );

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if focus is NOT on an input to avoid interfering with typing
      if ((e.target as HTMLElement).tagName === "INPUT") return;

      if (e.code === "Space") {
        e.preventDefault(); // prevent page scroll
        goNextImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNextImage]);

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-50 to-green-50">
      <div className="p-6 bg-gray-100 min-h-screen overflow-hidden">
        {/* ===== Progress Bar ===== */}
        <div className="max-w-6xl mx-auto mb-8">
          <ProgressBar
            progress={getProgress()}
            current={getValidatedCount()}
            total={getTotalDetections()}
          />

          {/* ===== Toolbar ===== */}
          <div className="flex items-center gap-2 mt-4">
            <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm border px-2">
              <Filter size={16} className="text-gray-400" />
              <select className="py-2 pl-1 pr-8 bg-transparent border-none text-sm focus:ring-0 cursor-pointer"></select>
            </div>

            {/* Prev / Next Image */}
            <button
              onClick={goPrevImage}
              className="flex items-center gap-1 bg-gray-400 hover:bg-gray-500 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-md hover:shadow-lg"
            >
              <SkipBack size={16} /> Prev Image
            </button>
            <button
              onClick={goNextImage}
              className="flex items-center gap-1 bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-md hover:shadow-lg"
            >
              Next Image <SkipForward size={16} />
            </button>

            {/* Jump to Image */}
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="w-24 px-2 py-1 border rounded text-sm"
                placeholder="Go to #"
                min={1}
                max={getImageCount()}
                value={jumpIndex}
                onChange={(e) =>
                  setJumpIndex(e.target.value ? parseInt(e.target.value) : "")
                }
                // handle Enter key to jump without clicking button
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (jumpIndex !== "" && !isNaN(jumpIndex)) {
                      goToImage(jumpIndex - 1);
                      setJumpIndex("");
                    }
                  }
                }}
              />

              {/* Filename + Layout Toggle */}
              <div className="flex items-center gap-2">
                <button
                  disabled
                  className="cursor-default bg-gray-100 text-gray-400 text-sm font-medium px-3 py-1 rounded shadow-sm"
                >
                  {`${currentImageIndex + 1} / ${getImageCount()} — ${currentImage?.uploaded_img?.split("/").pop()}`}
                </button>
                <button
                  onClick={() => setShowAltView(!showAltView)}
                  className="px-3 py-1 bg-purple-300 text-white rounded hover:bg-purple-200 flex items-center gap-1 text-sm shadow"
                >
                  <Layout size={16} />
                  {showAltView ? "Back to Main" : "Open Alt View"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ===== Main Grid ===== */}
        {showAltView ? (
          <AltMainContent />
        ) : (
          <div className="parent grid grid-cols-10 grid-rows-10 gap-1 h-screen overflow-hidden">
            {/* Full Image */}
            <div className="div1 col-start-1 col-end-7 row-start-1 row-end-6 bg-white rounded-lg shadow p-2 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-800">Full Image</h3>

                {/* Plant Info Display */}
                <div className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-md shadow-sm text-xs text-gray-800">
                  <span className="font-semibold text-green-700">
                    [{currentImage?.plant_type?.code || "—"}]
                  </span>
                  <span className="text-gray-400">:</span>
                  <span className="italic font-medium">
                    {currentImage?.plant_type?.label || "Unknown Plant"}
                  </span>

                  {typeof currentImage?.plant_type?.conf === "number" && (
                    <span className="text-gray-500 ml-2">
                      ({(currentImage.plant_type.conf).toFixed(2)}%)
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-hidden">
                <ImageViewer
                  imageSrc={currentImage?.uploaded_img || PLACEHOLDER_IMAGE.path}
                  currentDetection={currentDetection || null} // pass the selected detection
                  detections={currentImage?.detections || []}
                  zoomable={true}
                />
              </div>
            </div>

            {/* Cropped Region */}
            <div className="div2 col-start-7 col-end-9 row-start-1 row-end-6 bg-white rounded-lg shadow p-2 flex flex-col relative">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Detected Region</h3>
              <div className="flex-1 overflow-hidden relative">
                <ImageViewer imageSrc={currentDetection?.crop || PLACEHOLDER_IMAGE.path} 
                zoomable={false} // static, no zoom/slider
                />

                {/* Frosted Placeholder Overlay for No Detection */}
                {currentImage?.detections?.length === 0 && (
                  <div className="absolute inset-0 bg-white/50 backdrop-blur-md flex flex-col items-center justify-center rounded-lg z-20 animate-fadeIn">
                    {/* Floating animated plant */}
                    <span className="text-6xl mb-2 animate-floating">🌿</span>
                    <p className="text-green-700 font-semibold text-base">
                      This plant image has no detection!
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      Looks perfectly healthy — nothing to validate.
                    </p>
                  </div>
                )}

              </div>
              {currentDetection.status === "validated" && (
                <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1 shadow-lg z-10">
                  <Check size={16} />
                </div>
              )}
              {currentDetection.status === "healthy" && (
                <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1 shadow-lg z-10">
                  <Heart size={16} />
                </div>
              )}
              {currentDetection.status === "uncertain" && (
                <div className="absolute top-2 right-2 bg-yellow-500 text-white rounded-full p-1 shadow-lg z-10">
                  <HelpCircle size={16} />
                </div>
              )}
            </div>

            {/* Info Panel + Confidence Slider */}
            <div className="div3 col-start-9 col-end-11 row-start-1 row-end-9 bg-white rounded-lg shadow relative flex flex-col">
              {/* Confidence Slider Section */}
              <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700 font-medium">
                    Confidence:
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    // value={confidenceThreshold}
                    // onChange={(e) =>
                    //   setConfidenceThreshold(parseFloat(e.target.value))
                    // }
                    className="w-24"
                  />
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    // value={confidenceThreshold}
                    // onChange={(e) =>
                    //   setConfidenceThreshold(parseFloat(e.target.value))
                    // }
                    className="border border-gray-300 rounded-md px-2 py-1 w-14 text-sm text-center"
                  />
                </div>
                <span className="text-xs text-gray-500">
                  {/* ≥ {confidenceThreshold.toFixed(2)} */}
                </span>
              </div>

              {/* Info Panel */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <InfoPanel
                  currentImage={currentImage}
                  currentDetection={currentDetection}
                />
              </div>
            </div>

            {/* Navigator */}
            <div className="div4 col-start-1 col-end-9 row-start-6 row-end-7 bg-white rounded-lg shadow p-2 relative">
              {currentImage?.detections?.length === 0 && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg z-20 animate-fadeIn text-center px-3">
                  <p className="text-xs text-gray-600 italic">
                    You detect a defect? Don’t worry — new features to annotate will be coming soon.
                    <br />
                    <span className="text-green-600 font-medium">(InsyaAllah)</span>
                  </p>
                </div>
              )}

              <Navigator />
            </div>

            {/* Validation Controls */}
            <div className="div5 col-start-1 col-end-9 row-start-7 row-end-9 bg-white rounded-lg shadow p-2 flex flex-col relative overflow-hidden">
              <ValidationControls
                currentDetection={currentDetection}
                goNextDetection={goNextDetection}
                onValidate={async (decision, type) => {
                  validateDetection(decision, type || currentDetection.type);
                  await reloadMetadata();
                  goNextDetection();
                }}
                onDelete={async (crop) => {
                  console.log("Parent onDelete called for crop:", crop);
                  try {
                    await reloadMetadata();
                    goNextDetection();
                  } catch (err) {
                    console.error("Error in parent onDelete:", err);
                  }
                }}
              />
              {/* Frosted overlay just for ValidationControls */}
              {currentImage?.detections?.length === 0 && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg z-30">
                </div>
              )}
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
};
