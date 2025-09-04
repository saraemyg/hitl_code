import React, { useRef, useState, useEffect } from 'react';
import { Detection } from '../types';

interface ImageViewerProps {
  imageSrc: string;
  detection?: Detection; 
  className?: string;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  imageSrc,
  className = ""
}) => {
  const [imgSize, setImgSize] = useState({ width: 640, height: 640 });
  const [scale, setScale] = useState(1); // zoom scale
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // panning offset
  const [isDragging, setIsDragging] = useState(false);
  const [startDrag, setStartDrag] = useState({ x: 0, y: 0 });
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

  // Zoom in/out with mouse scroll
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomAmount = e.deltaY > 0 ? 0.9 : 1.1; // scroll up = zoom in
    setScale((prev) => {
      const newScale = Math.min(Math.max(prev * zoomAmount, 1), 5);
      return newScale;
    });
  };

  // Drag to move when zoomed in
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setStartDrag({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - startDrag.x,
        y: e.clientY - startDrag.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // ✅ Double-click resets zoom + pan
  const handleDoubleClick = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div
      className={`relative bg-gray-100 rounded-lg overflow-hidden flex justify-center items-center ${className}`}
      style={{ height: "400px", cursor: scale > 1 ? "grab" : "default" }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick} // 👈 added here
    >
      <img
        ref={imgRef}
        src={imageSrc}
        alt="Plant detection"
        onLoad={handleImageLoad}
        className="select-none w-full h-full object-cover"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: "center center",
          transition: isDragging ? "none" : "transform 0.2s ease-out",
          maxHeight: "100%",
          maxWidth: "100%",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};
