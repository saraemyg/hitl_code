// src/pages/SummaryPage.tsx
import React, { useEffect, useState, useMemo } from "react";
import { Detection, DEFECT_CLASSES } from "../types";
import { Palette, Eye, EyeOff } from "lucide-react";
import DashboardPage from "./DashboardPage";
import { motion, AnimatePresence } from "framer-motion";

const SummaryPage: React.FC = () => {
  const [groupedCrops, setGroupedCrops] = useState< Record<string, { src: string; confidence: number }[]>>({});
  const [pageIndex, setPageIndex] = useState<Record<string, number>>({});
  const [showConfidence, setShowConfidence] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false); 
  const [source, setSource] = useState<string>(""); // <-- track backend source

useEffect(() => {
  let cancelled = false;

  const fetchMetadata = async () => {
    try {
      const cached = localStorage.getItem("metadata"); // Check cache first
      if (cached) {
        setGroupedCrops(JSON.parse(cached));
      }

      const res = await fetch("http://localhost:8000/metadata");
      if (!res.ok) throw new Error(`Failed with ${res.status}`);
      const data = await res.json();
      if (cancelled) return;

      const groups: Record<string, { src: string; confidence: number }[]> = {};
      for (const item of data) {
        for (const det of item.detections) {
          const type = det.type.replace(/\s+/g, "");
          if (!groups[type]) groups[type] = [];

          if (det.crop) {
            groups[type].push({
              src: `http://localhost:8000/data/${det.crop.replace(/\\/g, "/")}`,
              confidence: det.conf,
            });
          }
        }
      }

      setGroupedCrops(groups);
      localStorage.setItem("metadata", JSON.stringify(groups));
    } catch (err) {
      console.error("Failed to fetch metadata", err);
    }
  };

  fetchMetadata();
  return () => {
    cancelled = true;
  };
}, []);

  // Sort DEFECT_CLASSES by count in groupedCrops
  const sortedClasses = useMemo(() => {
    return [...DEFECT_CLASSES].sort((a, b) => {
      const aKey = a.replace(/\s+/g, "");
      const bKey = b.replace(/\s+/g, "");
      return (groupedCrops[bKey]?.length || 0) - (groupedCrops[aKey]?.length || 0);
    });
  }, [groupedCrops]);

  return (
    <div className="p-6 space-y-10">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Palette className="text-blue-600" size={32} />
          <h1 className="text-3xl font-bold text-gray-800">Data Visualisation</h1>
          <div className="flex items-center space-x-2">
            {/* Toggle Dashboard Overlay */}
            <button
              onClick={() => setShowDashboard((prev) => !prev)}
              className="bg-gray-300 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
              {showDashboard ? (
                <>
                  <EyeOff size={16} /> Hide Dashboard
                </>
              ) : (
                <>
                  <Eye size={16} /> Show Dashboard
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard Overlay (above summary grid) */}
      <AnimatePresence>
        {showDashboard && (
          <motion.div
            className="mb-10 overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          >
            <DashboardPage />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overall Annotations Summary */}
      <section>
        <div className="grid grid-cols-4 grid-rows-2 gap-4">
          {/* Palette top-left */}
          <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center justify-center">
            {/* Image container */}
            <div className="bg-white rounded-lg shadow p-4 aspect-[4/3] flex items-center justify-center">
              <img
                src="/backend/reference_images/all_classes_palette.png"
                alt="All Classes Palette"
                className="w-full h-full object-cover rounded"
              />
            </div>
            <p className="mt-3 text-sm font-medium text-gray-700">Colour Palette</p>
            {/* Button under image */}
            <button
              onClick={() => setShowConfidence((prev) => !prev)}
              className="mt-4 bg-gray-200 hover:bg-gray-200 text-gray-500 px-4 py-2 rounded-lg flex items-center gap-2 transition"
            >
              {showConfidence ? (
                <>
                  <EyeOff size={16} />
                  <span>Hide AI Confidence</span>
                </>
              ) : (
                <>
                  <Eye size={16} />
                  <span>Show AI Confidence</span>
                </>
              )}
            </button>
          </div>

          {sortedClasses.map((cls) => {
            const prefix = cls.replace(/\s+/g, "");
            const allImgs = groupedCrops[prefix] || [];
            const sortedImgs = [...allImgs].sort(
              (a, b) => b.confidence - a.confidence
            );

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
                  Showing {start + 1}-{start + shownImgs.length} /{" "}
                  {sortedImgs.length}
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
                          loading="lazy"
                          src={img.src}
                          alt={`${cls} crop`}
                          className="object-cover w-full h-full"
                        />
                        {/* overlay confidence */}
                        {showConfidence && (() => {
                          const percentage = img.confidence * 100;
                          let colorClass = "bg-red-600/80"; // default with 80% opacity

                          if (percentage >= 80) {
                            colorClass = "bg-green-600/80";
                          } else if (percentage >= 50) {
                            colorClass = "bg-yellow-500/80 text-black";
                          }

                          return (
                            <span
                              className={`absolute bottom-1 right-1 ${colorClass} text-white text-[10px] px-1 rounded`}
                            >
                              {percentage.toFixed(2)}%
                            </span>
                          );
                        })()}
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400 col-span-5 text-center">
                      No crops found
                    </span>
                  )}
                </div>

                {/* Pagination controls */}
                {sortedImgs.length > perPage && (() => {
                  const totalPages = Math.ceil(sortedImgs.length / perPage);

                  return (
                    <div className="flex justify-between items-center text-xs text-gray-600 mt-2">
                      {/* Left side: First + Prev */}
                      <div className="flex space-x-2">
                        <button
                          disabled={page === 0}
                          onClick={() =>
                            setPageIndex((prev) => ({ ...prev, [prefix]: 0 }))
                          }
                          className={`px-2 py-1 rounded ${
                            page === 0
                              ? "bg-gray-200 cursor-not-allowed"
                              : "bg-gray-100 hover:bg-gray-200"
                          }`}
                        >
                          First
                        </button>

                        <button
                          disabled={page === 0}
                          onClick={() =>
                            setPageIndex((prev) => ({
                              ...prev,
                              [prefix]: Math.max((prev[prefix] || 0) - 1, 0),
                            }))
                          }
                          className={`px-2 py-1 rounded ${
                            page === 0
                              ? "bg-gray-200 cursor-not-allowed"
                              : "bg-gray-100 hover:bg-gray-200"
                          }`}
                        >
                          Prev
                        </button>
                      </div>

                      {/* Middle: dots indicator (max 5) */}
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          // Calculate window of pages
                          let start = Math.max(
                            0,
                            Math.min(page - 2, totalPages - 5)
                          );
                          const dotPage = start + i;

                          return (
                            <span
                              key={i}
                              className={`w-2 h-2 rounded-full ${
                                dotPage === page ? "bg-blue-600" : "bg-gray-400"
                              }`}
                            ></span>
                          );
                        })}
                      </div>

                      {/* Right side: Next + Last */}
                      <div className="flex space-x-2">
                        <button
                          disabled={page >= totalPages - 1}
                          onClick={() =>
                            setPageIndex((prev) => ({
                              ...prev,
                              [prefix]: (prev[prefix] || 0) + 1,
                            }))
                          }
                          className={`px-2 py-1 rounded ${
                            page >= totalPages - 1
                              ? "bg-gray-200 cursor-not-allowed"
                              : "bg-gray-100 hover:bg-gray-200"
                          }`}
                        >
                          Next
                        </button>

                        <button
                          disabled={page >= totalPages - 1}
                          onClick={() =>
                            setPageIndex((prev) => ({
                              ...prev,
                              [prefix]: totalPages - 1,
                            }))
                          }
                          className={`px-2 py-1 rounded ${
                            page >= totalPages - 1
                              ? "bg-gray-200 cursor-not-allowed"
                              : "bg-gray-100 hover:bg-gray-200"
                          }`}
                        >
                          Last
                        </button>
                      </div>
                    </div>
                  );
                })()}

              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default SummaryPage;
