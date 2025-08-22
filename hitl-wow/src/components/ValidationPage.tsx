import React from 'react';
import { ImageViewer } from './ImageViewer';
import { ValidationControls } from './ValidationControls';
import { ProgressBar } from './ProgressBar';
import { useDetectionData } from '../hooks/useDetectionData';
import { FileImage, Target } from 'lucide-react';
import { Detection } from '../types';

export const ValidationPage: React.FC = () => {
  const {
    getCurrentImage,
    getCurrentDetection,
    getCurrentCropPath,
    validateDetection,
    getTotalDetections,
    getValidatedCount,
    getProgress,
    currentImageIndex,
    imageData
  } = useDetectionData();

  // Placeholder image if dataset is empty or unreachable
  const placeholderImage = {
    name: "placeholder.jpg",
    path: "https://i.pinimg.com/736x/d4/71/c4/d471c4befa7ec4053d9eaf8e1034b870.jpg"
  };

  // Placeholder detection so nothing is ever null
  const placeholderDetection: Detection = {
    id: "0", bbox: [0, 0, 0, 0], confidence: 0, classId: 0, className: "placeholder",
    imagePath: "0.jpg", validated: false, validatedAs: "none", cropPath: "0.jpg"
  };

  const isUsingPlaceholder = imageData.length === 0;
  const currentImage = getCurrentImage() || placeholderImage;
  const cropImage = getCurrentCropPath() || placeholderImage.path;
  const currentDetection = isUsingPlaceholder ? placeholderDetection : getCurrentDetection();

  const progressText = isUsingPlaceholder
    ? "Preview Mode (No dataset found)"
    : `Image ${currentImageIndex + 1}/${imageData.length} - ${currentImage.name}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <FileImage className="text-blue-600" size={32} />
            <h1 className="text-3xl font-bold text-gray-800">
              Hahahahahahahaahah
            </h1>
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
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto grid grid-cols-2 grid-rows-2 gap-8">
          {/* Top Right - Full Image with Bounding Box */}
          <div className="row-start-1 col-start-2 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Full Image with Detection
            </h3>
            <ImageViewer
              imageSrc={currentImage.path} // Use the full image path
              detection={currentDetection} // Pass detection for bounding box
            />
          </div>

          {/* Top Left - Cropped Detection */}
          <div className="row-start-1 col-start-1 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Detected Region (Cropped)
            </h3>
            <ImageViewer
              imageSrc={cropImage} // Use the full image path
              detection={currentDetection} // Pass detection for cropping
              className="aspect-square"
            />
          </div>

          {/* Bottom Right - Validation Controls */}
          <div className="row-start-2 col-start-2 bg-white rounded-lg shadow-lg p-6 flex flex-col justify-top">
            <ValidationControls
              onValidate={validateDetection}
              detectedClass={currentDetection.className}
            />
          </div>

          {/* Bottom Left - Detection Info */}
          <div className="row-start-2 col-start-1 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Detection Details
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Class:</span>
                <span className="font-semibold">{currentDetection.className}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Confidence:</span>
                <span className="font-semibold">{currentDetection.confidence.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Bounding Box:</span>
                <span className="font-mono text-sm">
                  [{currentDetection.bbox.map((n: number) => n.toFixed(0)).join(', ')}]
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Detection ID:</span>
                <span className="font-mono text-sm">{currentDetection.id}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};