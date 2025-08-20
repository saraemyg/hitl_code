import React, { useRef, useState, useEffect } from 'react';
import { Detection } from '../types';

interface ImageViewerProps {
  imageSrc: string;
  detection: Detection;
  showBoundingBox?: boolean;
  className?: string;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  imageSrc,
  detection,
  showBoundingBox = true,
  className = ""
}) => {
  const [imgSize, setImgSize] = useState({ width: 640, height: 640 });
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete) {
      setImgSize({ width: img.naturalWidth, height: img.naturalHeight });
    }
  }, [imageSrc]);

  const handleImageLoad = () => {
    const img = imgRef.current;
    if (img) {
      setImgSize({ width: img.naturalWidth, height: img.naturalHeight });
    }
  };

  const [x1, y1, x2, y2] = detection.bbox;
  const { width, height } = imgSize;

  return (
    <div className={`relative bg-gray-100 rounded-lg overflow-hidden ${className}`}>
      <img
        ref={imgRef}
        src={imageSrc}
        alt="Plant detection"
        className="w-full h-full object-cover"
        onLoad={handleImageLoad}
      />

      {showBoundingBox && (
        <>
          {/* Bounding box overlay */}
          <div
            className="absolute border-4 border-green-400 bg-green-400 bg-opacity-10"
            style={{
              left: `${(x1 / width) * 100}%`,
              top: `${(y1 / height) * 100}%`,
              width: `${((x2 - x1) / width) * 100}%`,
              height: `${((y2 - y1) / height) * 100}%`,
              pointerEvents: 'none'
            }}
          />

          {/* Label */}
          <div
            className="absolute bg-green-400 text-black px-2 py-1 text-sm font-semibold rounded"
            style={{
              left: `${(x1 / width) * 100}%`,
              top: `${Math.max(0, (y1 - 30) / height) * 100}%`,
              pointerEvents: 'none'
            }}
          >
            {detection.className} ({detection.confidence.toFixed(2)})
          </div>
        </>
      )}
    </div>
  );
};