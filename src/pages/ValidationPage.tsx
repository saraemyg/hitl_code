import React, { useState, useEffect } from 'react';
import { ImageViewer } from '../components/ImageViewer';
import { ValidationControls } from '../components/ValidationControls';
import { ProgressBar } from '../components/ProgressBar';
import InfoPanel from "../components/InfoPanel";
import { useDetectionData } from '../hooks/useDetectionData';
import { SkipForward, SkipBack, Filter,Layout } from 'lucide-react';
import { Detection } from '../types';
import AnnotationPage from "../pages/AnnotationPage";

export const ValidationPage: React.FC = () => {
  const {
    getCurrentImage,
    getCurrentDetection,
    getCurrentCropPath,
    validateDetection,
    getTotalDetections,
    getValidatedCount,
    getProgress,
    moveToNextImage,
    moveToPrevImage,
    goToImage,
    getImageCount,
    currentImageIndex,
    windowData
  } = useDetectionData();

  const [cacheBust, setCacheBust] = useState(Date.now());
  const [jumpIndex, setJumpIndex] = useState<number | ''>('');
  const [showAltView, setShowAltView] = useState(false);

  // Placeholder handling
  const PLACEHOLDER_IMAGE = { name: "placeholder.jpg", path: "https://i.pinimg.com/736x/d4/71/c4/d471c4befa7ec4053d9eaf8e1034b870.jpg"};
  const PLACEHOLDER_DETECTION: Detection = { defect_id: 0, defect_type: "x", confidence: 0, bbox: [0, 0, 0, 0], status: "placeholder", crop_path: PLACEHOLDER_IMAGE.path };
  const isUsingPlaceholder = windowData.length === 0;

  // regenerate cacheBust whenever dataset or index changes
  useEffect(() => {
    setCacheBust(Date.now());
  }, [windowData, currentImageIndex]);

  // Current image + cache bust
  const currentImage = getCurrentImage();
  const imageSrc = (currentImage?.processed_img || PLACEHOLDER_IMAGE.path) + `?t=${cacheBust}`;
  const cropPath = getCurrentCropPath();
  const cropSrc = (cropPath || PLACEHOLDER_IMAGE.path) + `?t=${cacheBust}`;
  const currentDetection = isUsingPlaceholder ? PLACEHOLDER_DETECTION : getCurrentDetection();

  const AltMainContent: React.FC = () => {
    return (
      <div className="max-w-8xl mx-auto grid grid-cols-1 gap-3">
        <AnnotationPage
          currentImage={currentImage}
          currentDetection={currentDetection}
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      <div className="container mx-auto px-4 py-8">
        
        {/* Progress Bar */}
        <div className="max-w-6xl mx-auto mb-8">
          <ProgressBar 
            progress={getProgress()}
            current={getValidatedCount()}
            total={getTotalDetections()}
          />
          <div className="flex items-center gap-2 mt-4">
            {/* Filter Dropdown */}
            <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm border px-2">
              <Filter size={16} className="text-gray-400" />
              <select className="py-2 pl-1 pr-8 bg-transparent border-none text-sm focus:ring-0 cursor-pointer">
              </select>
            </div>

            {/* Prev button */}
            <button
              onClick={moveToPrevImage}
              className="flex items-center gap-1 bg-gray-400 hover:bg-gray-500 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-md hover:shadow-lg"
            >
              <SkipBack size={16} />
              Prev Image
            </button>

            {/* Next button */}
            <button
              onClick={moveToNextImage}
              className="flex items-center gap-1 bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-md hover:shadow-lg"
            >
              Next Image
              <SkipForward size={16} />
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
                  setJumpIndex(e.target.value ? parseInt(e.target.value) : '')
                }
              />
              <button
                className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm"
                onClick={() => {
                  if (jumpIndex !== '' && !isNaN(jumpIndex)) {
                    goToImage(jumpIndex - 1); // convert to 0-based
                    setJumpIndex('');
                  }
                }}
              >
                Go
              </button>

              {/* Filename + Toggle Button */}
              <div className="flex items-center gap-2">
                <button
                  disabled
                  className="cursor-default bg-gray-100 text-gray-400 text-sm font-medium px-3 py-1 rounded shadow-sm"
                >
                  {`${currentImageIndex + 1} / ${getImageCount()} — ${currentImage?.uploaded_img}`}
                </button>
                <button
                  onClick={() => setShowAltView(!showAltView)}
                  className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center gap-1 text-sm shadow"
                >
                  <Layout size={16} />
                  {showAltView ? "Back to Main" : "Open Alt View"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Toggle between main content and alternate content */}
        {showAltView ? (
          <AltMainContent />
        ) : (
          <div className="max-w-8xl mx-auto grid grid-cols-4 grid-rows-2 gap-3">
            {/* Full Image */}
            <div className="row-start-1 row-end-3 col-start-1 col-end-4 bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Full Image with Detection
              </h3>
              <ImageViewer
                imageSrc={imageSrc}
                detection={currentDetection}
              />
            </div>

            {/* Cropped Region */}
            <div className="row-start-1 row-end-3 col-start-4 col-end-6 bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Detected Region (Cropped)
              </h3>
              <div className="relative inline-block">
                <ImageViewer
                  imageSrc={cropSrc}
                  detection={currentDetection}
                  className="rounded-lg"
                />
                {(currentDetection.status === "validated" ||
                  currentDetection.status === "healthy") && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1 shadow-lg z-10">
                    ✔
                  </div>
                )}
              </div>
            </div>

            {/* Validation Controls */}
            <div className="row-start-3 col-start-1 col-end-5 bg-white rounded-lg shadow-lg p-6 flex flex-col justify-top">
              <ValidationControls
                onValidate={validateDetection}
                detectedClass={currentDetection.defect_type}
                confidence={Number(currentDetection.confidence) || 0}
              />
            </div>
            
            {/* Info Panel */}
            <div className="row-start-1 row-end-4 col-start-6 col-end-7">
              <InfoPanel
                currentImage={currentImage}
                currentDetection={currentDetection}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
