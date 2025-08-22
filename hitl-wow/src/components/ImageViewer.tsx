import React, { useRef, useState, useEffect } from 'react';
import { Detection } from '../types';

interface ImageViewerProps {
  imageSrc: string;
  detection?: Detection;  // now optional since we’re not using it
  className?: string;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  imageSrc,
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

  return (
    <div className={`relative bg-gray-100 rounded-lg overflow-hidden flex ${className}`}>
      <img
        ref={imgRef}
        src={imageSrc}
        alt="Plant detection"
        className="w-full h-full object-cover"
        onLoad={handleImageLoad}
      />
    </div>
  );
};
