// src/pages/SummaryPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Detection } from "../types";
import { FileImage } from 'lucide-react';

// not very scalable but works for now
export const NEW_DEFECT_CLASSES = [
  'Purpling',
  'Browning',
  'Yellowing',
  'BrownSpot',
  'BurnedTip',
  'Wilting',
  'Curling'
];

const SummaryPage: React.FC = () => {
  const navigate = useNavigate();
  const [groupedCrops, setGroupedCrops] = useState<Record<string, { src: string; confidence: number }[]>>({});
  const [pageIndex, setPageIndex] = useState<Record<string, number>>({});
  const [showConfidence, setShowConfidence] = useState(false);

  useEffect(() => {
    fetch("http://localhost:8000/metadata") // use backend URL
      .then((res) => res.json())
      .then((data) => {
        const groups: Record<string, { src: string; confidence: number }[]> = {};

        data.forEach((item: any) => {
          item.detections.forEach((det: Detection) => {
            const type = det.defect_type.replace(/\s+/g, "");
            if (!groups[type]) groups[type] = [];
            if (det.crop_path) {
              groups[type].push({
                src: "/" + det.crop_path.replace(/\\/g, "/"),
                confidence: det.confidence,
              });
            }
          });
        });

        setGroupedCrops(groups);
      })
      .catch((err) => console.error("Failed to fetch metadata", err));
  }, []);

  return (
    <div className="p-6 space-y-10">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <FileImage className="text-blue-600" size={32} />
          <h1 className="text-3xl font-bold text-gray-800">Data Visualisation</h1>
          <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowConfidence((prev) => !prev)}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg"
          >
            {showConfidence ? "Hide Confidence" : "Show Confidence"}
          </button>
        </div>
        </div>
      </div>

      {/* Overall Annotations Summary */}
      <section>
        
        <div className="grid grid-cols-4 grid-rows-2 gap-4">
          {/* Palette top-left */}
          <div className="bg-white rounded-lg shadow p-4 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow p-4 flex items-center justify-center aspect-[4/3]">
              <img
                src="/backend/reference_images/all_classes_palette.png"
                alt="All Classes Palette"
                className="w-full h-full object-cover rounded"
              />
            </div>
          </div>


          {NEW_DEFECT_CLASSES.map((cls) => {
            const prefix = cls.replace(/\s+/g, "");
            const allImgs = groupedCrops[prefix] || [];
            const sortedImgs = [...allImgs].sort((a, b) => b.confidence - a.confidence);

            const page = pageIndex[prefix] || 0;
            const perPage = 25;
            const start = page * perPage;
            const shownImgs = sortedImgs.slice(start, start + perPage);

            return (
              <div
                key={cls}
                className="bg-white rounded-lg shadow p-4 flex flex-col space-y-3"
              >
                <h3 className="text-sm font-semibold text-gray-700 text-center">
                  {cls}
                </h3>

                {/* Stat counter */}
                <p className="text-xs text-gray-500 text-center">
                  Showing {start + 1}-{start + shownImgs.length} / {sortedImgs.length}
                </p>

                {/* Mini crops grid */}
                <div className="grid grid-cols-5 gap-2 flex-1">
                  {shownImgs.length > 0 ? (
                    shownImgs.map((img, idx) => (
                      <div
                        key={idx}
                        className="bg-gray-100 rounded flex items-center justify-center overflow-hidden aspect-square relative"
                      >
                        <img
                          src={img.src}
                          alt={`${cls} crop`}
                          className="object-cover w-full h-full"
                        />
                        {/* overlay confidence */}
                        <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1 rounded">
                          {showConfidence && (() => {
                            const percentage = ((img.confidence / 1e10) * 100);
                            let colorClass = "bg-red-600"; // default red <50%

                            if (percentage >= 80) {
                              colorClass = "bg-green-600";
                            } else if (percentage >= 50) {
                              colorClass = "bg-yellow-500 text-black"; // yellow text easier to read
                            }

                            return (
                              <span
                                className={`absolute bottom-1 right-1 ${colorClass} text-white text-[10px] px-1 rounded`}
                              >
                                {percentage.toFixed(2)}%
                              </span>
                            );
                          })()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400 col-span-5 text-center">
                      No crops found
                    </span>
                  )}
                </div>

                {/* Pagination controls */}
                {sortedImgs.length > perPage && (
                  <div className="flex justify-between text-xs text-gray-600 mt-2">
                    <button
                      disabled={page === 0}
                      onClick={() =>
                        setPageIndex((prev) => ({
                          ...prev,
                          [prefix]: Math.max((prev[prefix] || 0) - 1, 0),
                        }))
                      }
                      className={`px-2 py-1 rounded ${
                        page === 0 ? "bg-gray-200 cursor-not-allowed" : "bg-gray-100 hover:bg-gray-200"
                      }`}
                    >
                      Prev
                    </button>
                    <button
                      disabled={start + perPage >= sortedImgs.length}
                      onClick={() =>
                        setPageIndex((prev) => ({
                          ...prev,
                          [prefix]: (prev[prefix] || 0) + 1,
                        }))
                      }
                      className={`px-2 py-1 rounded ${
                        start + perPage >= sortedImgs.length
                          ? "bg-gray-200 cursor-not-allowed"
                          : "bg-gray-100 hover:bg-gray-200"
                      }`}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            );
          })}


        </div>
      </section>
    </div>
  );
};

export default SummaryPage;
