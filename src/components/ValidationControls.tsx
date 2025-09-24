import React, { useState, useRef } from 'react';
import { Check, X, AlertTriangle, Trash2, Album, ChevronLeft, ChevronRight} from 'lucide-react';
import { DEFECT_CLASSES, Detection } from '../types';

interface ValidationControlsProps {
  onValidate: (decision: "correct" | "healthy" | "other" |"uncertain"| "next" | "back", className?: string) => void;
  detectedClass: string;   // YOLO class (for display)
  crop: string;      // unique identifier from backend
  detections?: Detection[];
}

// CropStrip Sub-component 
function CropStrip({
  detections = [],
  onSelect,
}: {
  detections?: Detection[];
  onSelect: (det: Detection) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handlePrev = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      onSelect(detections[newIndex]);
      scrollToIndex(newIndex);
    }
  };

  const handleNext = () => {
    if (detections && currentIndex < detections.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      onSelect(detections[newIndex]);
      scrollToIndex(newIndex);
    }
  };

  const scrollToIndex = (index: number) => {
    const container = scrollRef.current;
    if (container) {
      const child = container.children[index] as HTMLElement;
      if (child) {
        container.scrollTo({
          left:
            child.offsetLeft - container.clientWidth / 2 + child.clientWidth / 2,
          behavior: "smooth",
        });
      }
    }
  };

  // Show real detections if available, otherwise show 5 placeholders
  const displayItems =
    detections && detections.length > 0
      ? detections
      : Array(5).fill({ crop: "https://i.pinimg.com/736x/2f/7d/69/2f7d695dd14f09ee582631cb5d08f9ea.jpg" });

  return (
    <div className="flex items-center space-x-2">
      {/* Prev button */}
      <button
        onClick={handlePrev}
        disabled={currentIndex === 0}
        className="p-2 bg-gray-200 rounded-lg disabled:opacity-50"
      >
        <ChevronLeft size={18} />
      </button>

      {/* Crops scroll strip */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto space-x-2 w-full max-w-3xl scrollbar-hide"
      >
        {displayItems.map((det: Detection, idx: number) => (
          <img
            key={idx}
            src={det.crop || "https://via.placeholder.com/64"}
            alt={`Crop ${idx}`}
            onClick={() => {
              setCurrentIndex(idx);
              onSelect(det);
            }}
            className={`w-20 h-20 object-cover rounded-lg cursor-pointer border-2 ${
              idx === currentIndex ? "border-blue-500" : "border-transparent"
            }`}
          />
        ))}
      </div>

      {/* Next button */}
      <button
        onClick={handleNext}
        disabled={detections && currentIndex === detections.length - 1}
        className="p-2 bg-gray-200 rounded-lg disabled:opacity-50"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

// Validation Controls Components
export const ValidationControls: React.FC<ValidationControlsProps> = ({ 
  onValidate, 
  detectedClass = "Unknown",
  crop,
  detections = [],
}) => {
  const [selectedClass, setSelectedClass] = useState(DEFECT_CLASSES[0]);
  
  const validateDetection = async (
    decision: "correct" | "healthy" | "other" | "uncertain" ,
    className?: string
  ) => {
    try {
      let body: any = { decision, crop };
      if (decision === "other" && className) {body.type = className;}

      const res = await fetch(`http://localhost:8000/detections/validate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to update detection");
      const updated = await res.json();
      console.log("Detection updated:", updated);

      onValidate(decision, className);
    } catch (err) {
      console.error("Error updating detection:", err);
    }
  };

return (
  <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">

    {/* Crop strip on top */}
      <CropStrip
        detections={detections}
        onSelect={(det) => console.log("Selected detection:", det)}
      />

    {/* Header */}
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-semibold text-gray-800">
        Detected: {detectedClass}
      </h3>
      <p className="text-gray-600 text-left">Please validate this detection:</p>
    </div>
    
    {/* Validation + Other/Delete buttons in one row */}
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">

      {/* Correct */}
      <button
        onClick={() => validateDetection("correct", detectedClass)}
        className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-lg font-semibold transition-colors duration-200 shadow-md hover:shadow-lg"
      >
        <Check size={20} />
        Correct
      </button>

      {/* Healthy */}
      <button
        onClick={() => validateDetection("healthy", detectedClass)}
        className="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold transition-colors duration-200 shadow-md hover:shadow-lg"
      >
        <X size={20} />
        Healthy
      </button>

      <div className="flex gap-2 col-span-3">
        {/* Uncertain */}
        <button
          onClick={() => validateDetection("uncertain", detectedClass)}
          className="flex items-center justify-center bg-red-500 hover:bg-red-600 text-white p-3 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
          title="Uncertain Detection"
        >
          <Album size={20} />
        </button>
        {/* Other */}
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
        >
          {DEFECT_CLASSES.map(className => (
            <option key={className} value={className}>
              {className}
            </option>
          ))}
        </select>
        <button
          onClick={() => validateDetection("other", selectedClass)}
          className="flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 shadow-md hover:shadow-lg"
        >
          <AlertTriangle size={18} />
          Other
        </button>

      </div>
    </div>
  </div>
  );
};

export default ValidationControls;