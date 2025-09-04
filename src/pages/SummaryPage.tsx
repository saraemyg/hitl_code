// src/pages/SummaryPage.tsx
import React from "react";
import { useNavigate } from "react-router-dom";

const CLASSES = [
  "Burned Tip",
  "Brownspot",
  "Curling",
  "Wilting",
  "Purpling",
  "Browning",
  "Yellowing",
];

const SummaryPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Data Visualisation</h1>
        <button
          onClick={() => navigate("/")}
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg"
        >
          Back to Validation
        </button>
      </div>

      {/* Overall Annotations Summary */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Overall Annotations Summary
        </h2>
        <div className="grid grid-cols-4 grid-rows-2 gap-4">
          {/* Palette top-left */}
          <div className="bg-white rounded-lg shadow p-4 flex items-center justify-center">
            <img
              src="/backend/reference_images/all_classes_palette.png"
              alt="All Classes Palette"
              className="max-w-full h-auto"
            />
          </div>

          {/* Class cards */}
          {CLASSES.map((cls) => (
            <div
              key={cls}
              className="bg-white rounded-lg shadow p-4 flex flex-col space-y-3"
            >
              <h3 className="text-sm font-semibold text-gray-700 text-center">
                {cls}
              </h3>
              {/* Mini crops grid */}
              <div className="grid grid-cols-2 gap-2 flex-1">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-100 rounded flex items-center justify-center h-16"
                  >
                    <span className="text-xs text-gray-500">Crop {idx + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default SummaryPage;
