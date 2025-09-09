import React, { useEffect, useState, useRef, useCallback } from "react";
import { Detection, DEFECT_CLASSES } from "../types";
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface AnnotationPageProps {
  currentImage: {
    uploaded_img: string;
    processed_img: string;
    detections: Detection[];
  };
  currentDetection: Detection;
}

type BBox = [number, number, number, number];
                        
const AnnotationPage: React.FC<AnnotationPageProps> = ({ 
  currentImage,
  currentDetection 
}) => {
  const [showProcessed, setShowProcessed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [imageError, setImageError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
 
  // annotation states
  const [selectedBox, setSelectedBox] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);

  // Get full image URLs - can optmiise here later
  const uploadedImageUrl = `http://localhost:8000/uploaded_img/${currentImage?.uploaded_img}`;
  const processedImageUrl = currentImage?.processed_img;

  // Reset position and zoom when image changes
  useEffect(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [currentImage]);

  // Wheel zoom handler
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

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [zoom, position]);

  // Annotator
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
    if (selectedBox !== null && startPoint) {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const current = {
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100
      };

      if (isResizing) {
        const detection = currentImage.detections[selectedBox];
        const [x1, y1] = detection.bbox;
        
        // Ensure we create a proper BBox array with 4 elements
        const newBbox: BBox = [
          x1,
          y1,
          Math.max(x1, Math.min(100, current.x)),
          Math.max(y1, Math.min(100, current.y))
        ];
        
        // Update detection
        const newDetections = [...currentImage.detections];
        newDetections[selectedBox] = {
          ...detection,
          bbox: newBbox
        };
        
        // Call updateDetection with the new bbox
        updateDetection(newBbox);
      }
    }
  };

    const handleMouseUp = () => {
      if (selectedBox !== null && startPoint) {
        // Save changes
        setStartPoint(null);
        setIsResizing(false);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [selectedBox, startPoint, isResizing]);

  const handleMouseUp = () => setIsDragging(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: position.x + e.movementX,
        y: position.y + e.movementY
      });
    }
  };

  const resetZoom = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const getRelativeCoordinates = (e: React.MouseEvent): { x: number; y: number } => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    
    const rect = container.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100
    };
  };

  if (!currentImage) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">No image selected</p>
      </div>
    );
  }

  const updateDetection = async (bbox: BBox) => {
    if (!currentImage || !currentDetection) return;

    try {
      const response = await fetch('http://localhost:8000/update-detection', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_name: currentImage.uploaded_img,
          detection_id: currentDetection.defect_id,
          bbox: bbox,
          defect_type: currentDetection.defect_type
        })
      });
      
      if (!response.ok) throw new Error('Failed to update detection');
      
      const result = await response.json();
      console.log('Detection updated:', result);
      
    } catch (error) {
      console.error('Error updating detection:', error);
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Controls Header */}
      <div className="flex justify-between items-center p-4 border-b">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-800">Image Comparison</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom(prev => Math.max(prev - 0.5, 1))}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ZoomOut size={20} />
            </button>
            <span className="text-sm text-gray-600">{(zoom * 100).toFixed(0)}%</span>
            <button
              onClick={() => setZoom(prev => Math.min(prev + 0.5, 5))}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ZoomIn size={20} />
            </button>
            <button onClick={resetZoom} className="p-2 hover:bg-gray-100 rounded">
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
      <div className="flex flex-1 gap-4 p-4">
        {/* Image Viewer */}
        <div className="flex-1">
          <div 
            ref={containerRef}
            className="relative w-full h-[600px] overflow-hidden border-2 border-gray-200 rounded-lg bg-gray-50"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: zoom > 1 ? 'grab' : 'default' }}
          >
            {/* Image Container */}
            <div
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                transform: `scale(${zoom}) translate(${position.x}px, ${position.y}px)`,
                transformOrigin: 'center',
                transition: isDragging ? 'none' : 'transform 0.2s'
              }}
            >
              {/* Original Image */}
              <img
                src={uploadedImageUrl}
                alt="Original"
                className="absolute top-0 left-0 w-full h-full object-contain"
                style={{ opacity: showProcessed ? 0 : 1 }}
                onError={() => setImageError(true)}
              />
              {/* Processed Image */}
              <img
                src={processedImageUrl}
                alt="Processed"
                className="absolute top-0 left-0 w-full h-full object-contain"
                style={{ opacity: showProcessed ? 1 : 0 }}
                onError={() => setImageError(true)}
              />
            </div>

          {/* Bounding Boxes Overlay */}
          {showBoundingBoxes && currentImage?.detections && (
          <div className="absolute inset-0 pointer-events-none">
            {currentImage.detections.map((det, idx) => {
              const [x1, y1, x2, y2] = det.bbox as BBox;
              const isSelected = selectedBox === idx;
              
              return (
                <div
                  key={idx}
                  className={`absolute border-2 ${
                    isSelected ? 'border-blue-500' : 'border-green-500'
                  } bg-green-500/10 cursor-move`}
                  style={{
                    left: `${x1}%`,
                    top: `${y1}%`,
                    width: `${Math.max(0, x2 - x1)}%`,
                    height: `${Math.max(0, y2 - y1)}%`,
                    pointerEvents: 'all'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedBox(idx);
                  }}
                  onMouseDown={(e) => {
                    if (isSelected) {
                      e.stopPropagation();
                      setStartPoint(getRelativeCoordinates(e));
                    }
                  }}
                >
                  {/* Resize handle */}
                  <div 
                    className="absolute -right-1 -bottom-1 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-se-resize"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setIsResizing(true);
                      setStartPoint(getRelativeCoordinates(e));
                    }}
                  />
                  
                  {/* Label */}
                  <span className="absolute -top-6 left-0 bg-green-500 text-white px-2 py-0.5 text-xs rounded">
                    {det.defect_type} ({(det.confidence * 100).toFixed(1)}%)
                  </span>
                </div>
              );
            })}
          </div>
        )}
            
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="w-64 flex flex-col gap-4">
          <div className="bg-gray-50 p-4 rounded-lg border">
            <h2 className="font-semibold mb-3">Quick Annotate</h2>
            <div className="space-y-2">
              {DEFECT_CLASSES.map(defectClass => (
                <button
                  key={defectClass}
                  className="w-full px-3 py-2 text-sm bg-white hover:bg-gray-50 
                           border rounded-lg text-left transition-colors"
                  onClick={() => console.log(`Annotating as ${defectClass}`)}
                >
                  {defectClass}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnotationPage;