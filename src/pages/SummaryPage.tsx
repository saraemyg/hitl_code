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
                    <>
                      {shownImgs.map((img, idx) => (
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
                      ))}

                      {/* --- Fill empty slots to maintain consistent 5x5 grid --- */}
                      {Array.from({ length: perPage - shownImgs.length }).map((_, i) => (
                        <div
                          key={`placeholder-${i}`}
                          className="bg-transparent aspect-square rounded"
                        />
                      ))}
                    </>
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
            animate={{ x: "0%" }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="fixed inset-0 bg-white z-50 shadow-2xl flex flex-col overflow-hidden"
            style={{ width: "98vw", height: "100vh" }}
          >
            {/* Close Button */}
            <button
              onClick={() => setActiveClass(null)}
              className="absolute top-4 left-4 p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition"
            >
              <X size={20} className="text-gray-700" />
            </button>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto px-10 pb-16 pt-12">
              {/* Non-sticky Header Section */}
              <div className="bg-white pb-4 border-b border-gray-100">
                <div className="text-center mb-4 mt-6">
                  <h2 className="text-2xl font-bold text-gray-800">{activeClass}</h2>
                  <p className="text-sm text-gray-500 mt-1">Detailed Insights</p>
                </div>

                {/* Summary Stats */}
                {(() => {
                  const key = activeClass.replace(/\s+/g, "");
                  const items = groupedCrops[key] || [];
                  const total = items.length;
                  const avgConf =
                    total > 0
                      ? (items.reduce((acc, x) => acc + x.confidence, 0) / total) * 100
                      : 0;
                  const highConf = items.filter((x) => x.confidence >= 0.8).length;

                  return (
                    <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                      <div className="bg-blue-50 p-4 rounded-lg shadow-sm">
                        <p className="text-3xl font-semibold text-blue-600">{total}</p>
                        <p className="text-xs text-gray-500">Total Detections</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg shadow-sm">
                        <p className="text-3xl font-semibold text-green-600">
                          {avgConf.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500">Average Confidence</p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg shadow-sm">
                        <p className="text-3xl font-semibold text-purple-600">
                          {((highConf / total) * 100 || 0).toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500">High Confidence Ratio</p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Scrollable Inner Content */}
              <div className="mt-8">
                {/* Confidence Distribution (Fixed + Beautiful Version) */}
                {(() => {
                  const key = activeClass;
                  const items = groupedCrops[key] || [];

                  // Guard: no data
                  if (!items || items.length === 0) {
                    return (
                      <div className="mb-10 p-6 rounded-xl bg-gray-50 border border-gray-200 text-center text-gray-400 italic">
                        No confidence data available.
                      </div>
                    );
                  }

                  // Count confidence bins (0–1 range)
                  const bins = [0, 0, 0, 0, 0];
                  items.forEach((x) => {
                    const conf =
                      typeof x.confidence === "number"
                        ? Math.min(Math.max(x.confidence, 0), 1)
                        : 0;
                    const idx = Math.min(4, Math.floor(conf * 5)); // 0–4 bins
                    bins[idx]++;
                  });

                  const max = Math.max(...bins, 1);

                  const colors = [
                    "from-red-400 to-red-500",
                    "from-orange-400 to-yellow-400",
                    "from-yellow-300 to-lime-400",
                    "from-green-400 to-emerald-500",
                    "from-emerald-500 to-green-700",
                  ];

                  return (
                    <div className="mb-10 p-4 rounded-xl bg-gray-50 border border-gray-200 shadow-inner">
                      <h3 className="text-base font-semibold text-gray-700 mb-4 text-center">
                        Confidence Distribution
                      </h3>

                      <div className="relative flex justify-between items-end h-36 gap-4 px-4">
                        {/* Faint grid lines */}
                        <div className="absolute inset-0 flex flex-col justify-between opacity-10">
                          {[...Array(4)].map((_, i) => (
                            <div
                              key={i}
                              className="border-t border-gray-400"
                              style={{ top: `${(i + 1) * 25}%` }}
                            ></div>
                          ))}
                        </div>

                        {bins.map((count, i) => {
                          const height = Math.max((count / max) * 100, 4);
                          return (
                            <div key={i} className="flex flex-col items-center flex-1 group">
                              {/* Animated Bar */}
                              <div
                                className={`w-8 bg-gradient-to-t ${colors[i]} rounded-t-2xl shadow-md transition-all duration-500 ease-out group-hover:scale-105`}
                                style={{ height: `${height}%` }}
                                title={`${count} detections`}
                              ></div>

                              {/* Label */}
                              <span className="text-[11px] text-gray-500 mt-2 font-medium">
                                {i * 20}-{(i + 1) * 20}%
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <p className="text-[11px] text-gray-400 text-center mt-3 italic">
                        Higher bars → more detections in that confidence range
                      </p>
                    </div>
                  );
                })()}


                {/* Top & Random Examples */}
                {(() => {
                  const key = activeClass.replace(/\s+/g, "");
                  const items = groupedCrops[key] || [];
                  const sorted = [...items].sort((a, b) => b.confidence - a.confidence);
                  const top5 = sorted.slice(0, 5);
                  const random = sorted.slice(0, 100); // top 100 confidence

                  return (
                    <>
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">
                          Top 5 High-Confidence Samples
                        </h3>
                        <div className="grid grid-cols-5 gap-2">
                          {top5.map((img, i) => (
                            <div
                              key={i}
                              className="relative rounded overflow-hidden aspect-square"
                            >
                              <img
                                src={img.src}
                                className="object-cover w-full h-full"
                                alt="top sample"
                              />
                              <span className="absolute bottom-1 right-1 bg-green-600/80 text-white text-[10px] px-1 rounded">
                                {(img.confidence * 100).toFixed(1)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mb-10">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">
                          Top 100 Random Samples (Sorted by Confidence)
                        </h3>
                        <div className="grid grid-cols-10 gap-1">
                          {random.map((img, i) => (
                            <div
                              key={i}
                              className="relative rounded overflow-hidden aspect-square group"
                            >
                              <img
                                src={img.src}
                                className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-200"
                                alt="random sample"
                              />
                              <span className="absolute bottom-1 right-1 bg-gray-800/70 text-white text-[9px] px-1 rounded opacity-0 group-hover:opacity-100 transition">
                                {(img.confidence * 100).toFixed(1)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SummaryPage;
