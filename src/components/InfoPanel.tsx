import React, { useMemo } from "react";
import { Detection } from "../types";

interface InfoPanelProps {
  currentImage: any; 
  currentDetection: Detection;
}

const InfoPanel: React.FC<InfoPanelProps> = ({
  currentImage,
  currentDetection,
}) => {
  // Compute detailed stats when currentImage changes
  const stats = useMemo(() => {
    if (!currentImage?.detections) {
      return {
        total: 0,
        byType: {},
        byStatus: {
          validated: 0,
          unvalidated: 0,
          healthy: 0
        }
      };
    }

    const detections: Detection[] = currentImage.detections;
    
    // Count by defect type
    const byType = detections.reduce((acc: Record<string, number>, d: Detection) => {
      acc[d.defect_type] = (acc[d.defect_type] || 0) + 1;
      return acc;
    }, {});

    // Count by validation status
    const byStatus = detections.reduce((acc: Record<string, number>, d: Detection) => {
      if (d.defect_type === "healthy") {
        acc.healthy = (acc.healthy || 0) + 1;
      } else if (d.status === "validated") {
        acc.validated = (acc.validated || 0) + 1;
      } else {
        acc.unvalidated = (acc.unvalidated || 0) + 1;
      }
      return acc;
    }, { validated: 0, unvalidated: 0, healthy: 0 });

    return {
      total: detections.length,
      byType,
      byStatus
    };
  }, [currentImage]);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 h-full">

      {/* Detection Details */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
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
              {(currentDetection.confidence / 1e10 * 100).toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Bounding Box:</span>
            <span className="font-mono text-sm">
              [{currentDetection.bbox.map((n: number) => n.toFixed(0)).join(", ")}]
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Detection ID:</span>
            <span className="font-mono text-sm">{currentDetection.defect_id}</span>
          </div>
        </div>
      </div>

      {/* Image Info */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-md font-semibold text-gray-800 mb-3">Image Info</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Total Detections:</span>
            <span className="font-semibold">{stats.total}</span>
          </div>
          
          {/* Status Counts */}
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Status Breakdown:</h4>
            <div className="ml-2 space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">✓ Validated:</span>
                <span className="text-green-600 font-semibold">{stats.byStatus.validated}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">⚠ Unvalidated:</span>
                <span className="text-yellow-600 font-semibold">{stats.byStatus.unvalidated}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">❤ Healthy:</span>
                <span className="text-blue-600 font-semibold">{stats.byStatus.healthy}</span>
              </div>
            </div>
          </div>

          {/* Defect Type Breakdown */}
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Defect Types:</h4>
            <div className="ml-2 space-y-1">
              {Object.entries(stats.byType).map(([type, count]) => (
                <div key={type} className="flex justify-between">
                  <span className="text-gray-600">{type}:</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default InfoPanel;
