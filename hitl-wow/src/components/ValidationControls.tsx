import React, { useState } from 'react';
import { Check, X, AlertTriangle } from 'lucide-react';
import { DEFECT_CLASSES } from '../types';

interface ValidationControlsProps {
  onValidate: (decision: 'correct' | 'healthy' | 'other', className?: string) => void;
  detectedClass: string;
}

export const ValidationControls: React.FC<ValidationControlsProps> = ({ 
  onValidate, 
  detectedClass 
}) => {
  const [selectedClass, setSelectedClass] = useState(DEFECT_CLASSES[0]);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          Detected: {detectedClass}
        </h3>
        <p className="text-gray-600">Please validate this detection:</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => onValidate('correct')}
          className="flex items-center justify-center gap-3 bg-green-500 hover:bg-green-600 text-white px-6 py-4 rounded-lg font-semibold transition-colors duration-200 shadow-md hover:shadow-lg"
        >
          <Check size={24} />
          Correct Defect
        </button>

        <button
          onClick={() => onValidate('healthy')}
          className="flex items-center justify-center gap-3 bg-blue-500 hover:bg-blue-600 text-white px-6 py-4 rounded-lg font-semibold transition-colors duration-200 shadow-md hover:shadow-lg"
        >
          <X size={24} />
          Healthy (No Defect)
        </button>
      </div>

      <div className="border-t pt-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
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
            onClick={() => onValidate('other', selectedClass)}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-200 shadow-md hover:shadow-lg"
          >
            <AlertTriangle size={20} />
            Confirm Other
          </button>
        </div>
      </div>
    </div>
  );
};
