import React, { useEffect, useState, useMemo, useRef } from "react";
import { DEFECT_CLASSES } from "../types";
import { Palette, Eye, EyeOff, X, GripVertical } from "lucide-react";
import DashboardPage from "./DashboardPage";
import { motion, AnimatePresence } from "framer-motion";
import { fetchDetectionMetadata } from "../hooks/useDetectionData";

const SummaryPage: React.FC = () => {
  const [groupedCrops, setGroupedCrops] = useState<Record<string, { src: string; confidence: number }[]>>({});
  const [pageIndex, setPageIndex] = useState<Record<string, number>>({});
  const [showConfidence, setShowConfidence] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [activeClass, setActiveClass] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState<number>(75); // percentage of screen
  const [isResizing, setIsResizing] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  // Handle dragging for panel resize
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    const newWidth = ((window.innerWidth - e.clientX) / window.innerWidth) * 100;
    const clampedWidth = Math.min(95, Math.max(40, newWidth)); // limit between 40–95%
    setPanelWidth(clampedWidth);
  };

  const handleMouseUp = () => setIsResizing(false);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    let cancelled = false;
    const loadMetadata = async () => {
      try {
        const cached = localStorage.getItem("metadata");
        if (cached) setGroupedCrops(JSON.parse(cached));

        const data = await fetchDetectionMetadata("detection_v1/detection_v1_metadata.json");
        if (cancelled) return;

        const groups: Record<string, { src: string; confidence: number }[]> = {};
        for (const item of data) {
          for (const det of item.detections) {
            const type = det.type.replace(/\s+/g, "");
            if (!groups[type]) groups[type] = [];
            if (det.crop) {
              groups[type].push({
                src: det.crop,
                confidence: det.conf,
              });
            }
          }
        }
        setGroupedCrops(groups);
        localStorage.setItem("metadata", JSON.stringify(groups));
      } catch (err) {
        console.error("❌ Failed to load metadata:", err);
      }
    };

    loadMetadata();
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedClasses = useMemo(() => {
    return [...DEFECT_CLASSES].sort((a, b) => {
      const aKey = a.replace(/\s+/g, "");
      const bKey = b.replace(/\s+/g, "");
      return (groupedCrops[bKey]?.length || 0) - (groupedCrops[aKey]?.length || 0);
    });
  }, [groupedCrops]);

  return (
    <div className="relative p-6 space-y-10 overflow-hidden">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Palette className="text-blue-600" size={32} />
          <h1 className="text-3xl font-bold text-gray-800">Data Visualisation</h1>
          <div className="flex items-center space-x-2">
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

      {/* Dashboard Overlay */}
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

      {/* Main Grid */}
      <section>
        <div className="grid grid-cols-4 grid-rows-2 gap-4">
          {/* Palette box */}
          <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center justify-center">
            <div className="bg-white rounded-lg shadow p-4 aspect-[4/3] flex items-center justify-center">
              <img
                src="/all_classes_palette.png"
                alt="All Classes Palette"
                className="w-full h-full object-cover rounded"
              />
            </div>
            <p className="mt-3 text-sm font-medium text-gray-700">Colour Palette</p>
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

          {/* Defect Grids */}
          {sortedClasses.map((cls) => {
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
                className="bg-white rounded-lg shadow p-4 flex flex-col space-y-3 cursor-pointer hover:shadow-md transition"
                onClick={() => setActiveClass(cls)}
              >
                <h3 className="text-sm font-semibold text-gray-700 text-center">{cls}</h3>
                <p className="text-xs text-gray-500 text-center">
                  Showing {start + 1}-{start + shownImgs.length} / {sortedImgs.length}
                </p>

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
                        {showConfidence && (
                          <span
                            className={`absolute bottom-1 right-1 ${
                              img.confidence * 100 >= 80
                                ? "bg-green-600/80"
                                : img.confidence * 100 >= 50
                                ? "bg-yellow-500/80 text-black"
                                : "bg-red-600/80"
                            } text-white text-[10px] px-1 rounded`}
                          >
                            {(img.confidence * 100).toFixed(2)}%
                          </span>
                        )}
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
                    <div className="flex justify-between items-center text-xs text-gray-600 mt-2"
                    onClick={(e) => e.stopPropagation()}>
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
                        {Array.from({ length: Math.min(10, totalPages) }, (_, i) => {
                          // Calculate window of pages
                          let start = Math.max(
                            0,
                            Math.min(page - 2, totalPages - 10)
                          );
                          const dotPage = start + i;

                          return (
                            <span
                              key={i}
                              className={`w-2 h-2 rounded-full ${
                                dotPage === page ? "bg-blue-500" : "bg-gray-300"
                              }`}
                            ></span>
                          );
                        })}
                      </div>

                      {/* Right side: Next + Last */}
                      <div className="flex space-x-2">
                        <button
                          disabled={page >= totalPages - 1}
                          onClick={(e) =>
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

      {/* Blurred Overlay */}
      <AnimatePresence>
        {activeClass && (
          <motion.div
            key="overlay"
            className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => setActiveClass(null)}
          />
        )}
      </AnimatePresence>

      {/* Resizable Slide-in Panel */}
      <AnimatePresence>
        {activeClass && (
          <motion.div
            key="slide-panel"
            ref={panelRef}
            initial={{ x: "100%" }}
            animate={{ x: `${100 - panelWidth}%` }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="fixed top-0 right-0 bottom-0 bg-white shadow-2xl z-50 p-8 flex flex-col"
            style={{ width: `${panelWidth}vw` }}
          >
            {/* Close Button - top-left */}
            <button
              onClick={() => setActiveClass(null)}
              className="absolute top-4 left-4 p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition"
            >
              <X size={20} className="text-gray-700" />
            </button>

            {/* Drag handle */}
            <div
              onMouseDown={handleMouseDown}
              className="absolute top-0 left-0 h-full w-2 cursor-ew-resize bg-transparent group"
            >
              <div className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 opacity-60 group-hover:opacity-90 transition">
                <GripVertical size={16} />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col items-center justify-center text-gray-600 italic select-none">
              <p className="text-lg text-center">
                ✨ Detailed view for <span className="font-semibold">{activeClass}</span> coming soon! ✨
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SummaryPage;
