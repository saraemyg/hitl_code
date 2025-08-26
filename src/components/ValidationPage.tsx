import React, { useState, useEffect } from 'react';
import { ImageViewer } from './ImageViewer';
import { ValidationControls } from './ValidationControls';
import { ProgressBar } from './ProgressBar';
import { useDetectionData } from '../hooks/useDetectionData';
import { FileImage, SkipForward, SkipBack } from 'lucide-react';
import { Detection } from '../types';

// Placeholder handling
const PLACEHOLDER_IMAGE = {
  name: "placeholder.jpg",
  path: "https://i.pinimg.com/736x/d4/71/c4/d471c4befa7ec4053d9eaf8e1034b870.jpg"
};
const PLACEHOLDER_DETECTION: Detection = {
  defect_id: 0,
  defect_type: "placeholder",
  confidence: 0,
  bbox: [0, 0, 0, 0],
  status: "placeholder",
  crop_path: PLACEHOLDER_IMAGE.path
};

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
    currentImageIndex,
    windowData
  } = useDetectionData();

  const [cacheBust, setCacheBust] = useState(Date.now());

  // regenerate cacheBust whenever dataset or index changes
  useEffect(() => {
    setCacheBust(Date.now());
  }, [windowData, currentImageIndex]);

  const isUsingPlaceholder = windowData.length === 0;

  // Current image + cache bust
  const currentImage = getCurrentImage();
  const imageSrc = (currentImage?.processed_img || PLACEHOLDER_IMAGE.path) + `?t=${cacheBust}`;

  // Current detection + crop + cache bust
  const currentDetection = isUsingPlaceholder ? PLACEHOLDER_DETECTION : getCurrentDetection();
  if (!currentDetection) {
    return <p>All images validated or no detection available.</p>;
  }
  const cropPath = getCurrentCropPath();
  const cropSrc = (cropPath || PLACEHOLDER_IMAGE.path) + `?t=${cacheBust}`;

  // Progress bar text
  const progressText = isUsingPlaceholder
    ? "Preview Mode (No dataset found)"
    : `Image ${currentImageIndex + 1} - ${currentImage?.uploaded_img}`;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      <div className="container mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <FileImage className="text-blue-600" size={32} />
            <h1 className="text-3xl font-bold text-gray-800">Hahahahahha</h1>
          </div>
          <p className="text-gray-600 text-lg">{progressText}</p>
        </div>

        {/* Progress Bar */}
        <div className="max-w-4xl mx-auto mb-8">
          <ProgressBar 
            progress={getProgress()}
            current={getValidatedCount()}
            total={getTotalDetections()}
          />
          <div className="flex gap-2">
            <button
              onClick={moveToPrevImage}
              className="flex items-center gap-1 bg-gray-400 hover:bg-gray-500 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-md hover:shadow-lg"
            >
              <SkipBack size={16} />
              Prev Image
            </button>
            <button
              onClick={moveToNextImage}
              className="flex items-center gap-1 bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-md hover:shadow-lg"
            >
              Next Image
              <SkipForward size={16} />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-8xl mx-auto grid grid-cols-4 grid-rows-2 gap-3">
          {/* Full Image */}
          <div className="row-start-1 col-start-1 col-end-3 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Full Image with Detection
            </h3>
            <ImageViewer
              imageSrc={imageSrc}
              detection={currentDetection}
            />
          </div>

          {/* Cropped Region */}
          <div className="row-start-1 col-start-3 col-end-5 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Detected Region (Cropped)
            </h3>
            <ImageViewer
              imageSrc={cropSrc}
              detection={currentDetection}
              // className="aspect-square"
            />
          </div>

          {/* Validation Controls */}
          <div className="row-start-2 col-start-3 col-end-5 bg-white rounded-lg shadow-lg p-6 flex flex-col justify-top">
            <ValidationControls
              onValidate={validateDetection}
              detectedClass={currentDetection.defect_type}
              confidence={Number(currentDetection.confidence) || 0}
            />
          </div>

          {/* Detection Info */}
          <div className="row-start-2 col-start-1 col-end-3 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Detection Details
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Class:</span>
                <span className="font-semibold">{currentDetection.defect_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Confidence:</span>
                <span className="font-semibold">
                  {(currentDetection.confidence / 1e10).toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Bounding Box:</span>
                <span className="font-mono text-sm">
                  [{currentDetection.bbox.map((n: number) => n.toFixed(0)).join(', ')}]
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Detection ID:</span>
                <span className="font-mono text-sm">{currentDetection.defect_id}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
