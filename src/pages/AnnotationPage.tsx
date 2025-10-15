import React, { useEffect, useState, useRef } from "react";
import { Detection } from "../types";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

interface AnnotationPageProps {
  currentImage: {
    uploaded_img: string;
    processed_img: string;
    detections: Detection[];
  };
  currentDetection: Detection;
}

interface BoundingBoxProps {
  bbox: [number, number, number, number];
  isHovered: boolean;
  defectType: string;
  confidence: number;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  imageWidth: number;
  imageHeight: number;
}

const BoundingBox: React.FC<BoundingBoxProps> = ({
  bbox,
  isHovered,
  defectType,
  confidence,
  onMouseEnter,
  onMouseLeave,
  imageWidth,
  imageHeight,
}) => {
  let [x1, y1, x2, y2] = bbox;

  // Clamp to image boundaries
  x1 = Math.max(0, Math.min(x1, imageWidth));
  y1 = Math.max(0, Math.min(y1, imageHeight));
  x2 = Math.max(0, Math.min(x2, imageWidth));
  y2 = Math.max(0, Math.min(y2, imageHeight));

  // Normalize to percentages
  x1 = (x1 / imageWidth) * 100;
  y1 = (y1 / imageHeight) * 100;
  x2 = (x2 / imageWidth) * 100;
  y2 = (y2 / imageHeight) * 100;

  // Calculate width & height in %
  const width = Math.max(0, x2 - x1);
  const height = Math.max(0, y2 - y1);

  return (
    <div
      className={`absolute border-2 ${
        isHovered ? "border-blue-500" : "border-green-500"
      } bg-green-500/10`}
      style={{
        left: `${x1}%`,
        top: `${y1}%`,
        width: `${width}%`,
        height: `${height}%`,
        pointerEvents: "all",
        zIndex: 10,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {isHovered && (
        <span className="absolute -top-6 left-0 bg-green-500 text-white px-2 py-0.5 text-xs rounded whitespace-nowrap">
          {defectType} ({(confidence * 100).toFixed(1)}%)
        </span>
      )}
    </div>
  );
};


const AnnotationPage: React.FC<AnnotationPageProps> = ({
  currentImage,
  currentDetection,
}) => {
  const [showProcessed, setShowProcessed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [imageError, setImageError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [hoveredBox, setHoveredBox] = useState<number | null>(null);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });

  // Full URLs
  const uploadedImageUrl = `${process.env.NEXT_PUBLIC_API_URL}/uploaded_img/${currentImage?.uploaded_img}`;
  const processedImageUrl = currentImage?.processed_img;

  // Reset zoom/position when image changes
  useEffect(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [currentImage]);

  // Zoom with mouse wheel
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY * -0.005;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const newZoom = Math.min(Math.max(zoom + delta, 1), 5);

      if (newZoom !== zoom) {
        const scale = newZoom / zoom;
        const newX = x - (x - position.x) * scale;
        const newY = y - (y - position.y) * scale;

        setZoom(newZoom);
        setPosition({ x: newX, y: newY });
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [zoom, position]);

  const handleMouseDown = () => {
    if (zoom > 1) setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: position.x + e.movementX,
        y: position.y + e.movementY,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetZoom = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  if (!currentImage) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">No image selected</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Controls Header */}
      <div className="flex justify-between items-center p-4 border-b">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-800">Image Comparison</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom((prev) => Math.max(prev - 0.5, 1))}
              className="p-2 hover:bg-gray-100 rounded"
              title="Zoom Out"
            >
              <ZoomOut size={20} />
            </button>
            <span className="text-sm text-gray-600">
              {(zoom * 100).toFixed(0)}%
            </span>
            <button
              onClick={() => setZoom((prev) => Math.min(prev + 0.5, 5))}
              className="p-2 hover:bg-gray-100 rounded"
              title="Zoom In"
            >
              <ZoomIn size={20} />
            </button>
            <button
              onClick={resetZoom}
              className="p-2 hover:bg-gray-100 rounded"
              title="Reset Zoom"
            >
              <Maximize2 size={20} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showBoundingBoxes}
              onChange={(e) => setShowBoundingBoxes(e.target.checked)}
              className="rounded text-blue-500"
            />
            Show Bounding Boxes
          </label>
          <button
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
            onClick={() => setShowProcessed(!showProcessed)}
          >
            {showProcessed ? "Show Original" : "Show Processed"}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 p-4">
        {/* Image Viewer */}
        <div className="w-full">
          <div
            ref={containerRef}
            className="relative w-full h-[600px] overflow-hidden border-2 border-gray-200 rounded-lg bg-gray-50"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
              cursor: zoom > 2 ? "grab" : "default",
              position: "relative",
            }}
          >
            {/* Image Container */}
            <div
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                transform: `scale(${zoom}) translate(${position.x}px, ${position.y}px)`,
                transformOrigin: "center",
                transition: isDragging ? "none" : "transform 0.2s",
              }}
            >
              {/* Original Image */}
              <img
                src={uploadedImageUrl}
                alt="Original"
                className="absolute top-0 left-0 w-full h-full object-contain"
                style={{ opacity: showProcessed ? 0 : 1 }}
                onError={() => setImageError(true)}
                onLoad={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  setImageSize({ width: target.naturalWidth, height: target.naturalHeight });
                }}
              />
              {/* Processed Image */}
              <img
                src={processedImageUrl}
                alt="Processed"
                className="absolute top-0 left-0 w-full h-full object-contain"
                style={{ opacity: showProcessed ? 1 : 0 }}
                onError={() => setImageError(true)}
                onLoad={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  setImageSize({ width: target.naturalWidth, height: target.naturalHeight });
                }}
              />
            </div>

            {/* Adjustment 3: Bounding Boxes Overlay */}
            {showBoundingBoxes && currentImage?.detections && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  transform: `scale(${zoom}) translate(${position.x}px, ${position.y}px)`,
                  transformOrigin: "center",
                  transition: isDragging ? "none" : "transform 0.2s",
                }}
              >
                {/* {currentImage.detections.map((det, idx) => (
                  // <BoundingBox
                  //   key={idx}
                  //   bbox={det.bbox as [number, number, number, number]}
                  //   isHovered={hoveredBox === idx}
                  //   // defectType={det.defect_type}
                  //   // confidence={det.confidence}
                  //   onMouseEnter={() => setHoveredBox(idx)}
                  //   onMouseLeave={() => setHoveredBox(null)}
                  //   imageWidth={imageSize.width}   // ✅ pass natural width
                  //   imageHeight={imageSize.height} // ✅ pass natural height
                  // />
                ))} */}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnotationPage;
