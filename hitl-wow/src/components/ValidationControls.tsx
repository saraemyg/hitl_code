import React, { useState } from 'react';
import { Check, X, AlertTriangle, SkipForward, SkipBack } from 'lucide-react';
import { DEFECT_CLASSES } from '../types';

interface ValidationControlsProps {
  onValidate: (decision: "correct" | "healthy" | "other" | "next" | "back", className?: string) => void;
  detectedClass: string;   // YOLO class (for display)
  confidence: number;      // unique identifier from backend
}

export const ValidationControls: React.FC<ValidationControlsProps> = ({ 
  onValidate, 
  detectedClass,
  confidence
}) => {
  const [selectedClass, setSelectedClass] = useState(DEFECT_CLASSES[0]);
  
  const validateDetection = async (
    decision: "correct" | "healthy" | "other",
    className?: string
  ) => {
    try {
      let body: any = { decision };

      if (decision === "other" && className) {
        body.defect_type = className;
      }

      const res = await fetch(`http://localhost:8000/detections/${confidence}/validate`, {
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

  const deleteDetection = async () => {
    try {
      const res = await fetch(`http://localhost:8000/detections/${confidence}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete detection");
      const result = await res.json();
      console.log("Detection deleted:", result);

      onValidate("healthy");
    } catch (err) {
      console.error("Error deleting detection:", err);
    }
  };

  // Navigation handlers (no backend calls)
  const nextDetection = () => {
    console.log("Next detection:", confidence);
    onValidate("next");
  };

  const prevDetection = () => {
    console.log("Back to previous detection");
    onValidate("back");
  };
  
return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">
          Detected: {detectedClass}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={prevDetection}
            className="flex items-center gap-1 bg-gray-400 hover:bg-gray-500 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-md hover:shadow-lg"
          >
            <SkipBack size={16} />
            Back
          </button>
          <button
            onClick={nextDetection}
            className="flex items-center gap-1 bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-md hover:shadow-lg"
          >
            Next
            <SkipForward size={16} />
          </button>
        </div>
      </div>

      <p className="text-gray-600 text-center">Please validate this detection:</p>

      {/* Validation buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => validateDetection("correct", detectedClass)}
          className="flex items-center justify-center gap-3 bg-green-500 hover:bg-green-600 text-white px-6 py-4 rounded-lg font-semibold transition-colors duration-200 shadow-md hover:shadow-lg"
        >
          <Check size={24} />
          Correct Defect
        </button>

        <button
          onClick={() => validateDetection("healthy", detectedClass)}
          className="flex items-center justify-center gap-3 bg-blue-500 hover:bg-blue-600 text-white px-6 py-4 rounded-lg font-semibold transition-colors duration-200 shadow-md hover:shadow-lg"
        >
          <X size={24} />
          Healthy (No Defect)
        </button>
      </div>

      {/* Other / delete */}
      <div className="border-t pt-6 space-y-4">
        <label className="block text-sm font-medium text-gray-700">
          Or select different defect type:
        </label>
        <div className="flex gap-3">
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            {DEFECT_CLASSES.map(className => (
              <option key={className} value={className}>
                {className}
              </option>
            ))}
          </select>
          <button
            onClick={() => validateDetection("other", selectedClass)}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-200 shadow-md hover:shadow-lg"
          >
            <AlertTriangle size={20} />
            Confirm Other
          </button>
        </div>

        <button
          onClick={deleteDetection}
          className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-200 shadow-md hover:shadow-lg"
        >
          <X size={20} />
          Delete Detection
        </button>
      </div>
    </div>
  );
};
