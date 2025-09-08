import React, { useEffect, useState } from "react";

interface MetadataItem {
  uploaded_img: string;
  processed_img: string;
  detections: any[];
}

const BACKEND_URL = "http://localhost:8000";

const AnnotationPage: React.FC = () => {
  const [metadata, setMetadata] = useState<MetadataItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/metadata`);
        if (!response.ok) throw new Error("Failed to fetch metadata");
        const data = await response.json();
        setMetadata(data);
      } catch (error) {
        console.error("Error fetching metadata:", error);
      }
    };
    fetchMetadata();
  }, []);

  if (metadata.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <p className="text-gray-600 text-lg">Loading metadata...</p>
      </div>
    );
  }

  const currentImage = metadata[currentIndex];

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Controls Bar */}
      <div className="grid grid-cols-3 items-center p-4 bg-white shadow-md">
        {/* Left: Navigation */}
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
            className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 disabled:opacity-40 shadow-sm"
            disabled={currentIndex === 0}
          >
            Prev
          </button>
          <button
            onClick={() =>
              setCurrentIndex((prev) =>
                Math.min(prev + 1, metadata.length - 1)
              )
            }
            className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 disabled:opacity-40 shadow-sm"
            disabled={currentIndex === metadata.length - 1}
          >
            Next
          </button>
        </div>

        {/* Center: Overlay toggle + counter */}
        <div className="flex items-center justify-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showOverlay}
              onChange={() => setShowOverlay(!showOverlay)}
              className="h-4 w-4 accent-blue-500"
            />
            <span className="text-gray-700 font-medium">Show overlay</span>
          </label>
          <span className="text-gray-600 text-sm">
            {currentIndex + 1}/{metadata.length}
          </span>
        </div>

        {/* Right: Placeholder for tools */}
        <div className="flex justify-end text-gray-500 text-sm italic">
          Future tools here
        </div>
      </div>

      {/* Image Viewer */}
      <div className="flex-1 flex items-center justify-center relative bg-gray-50">
        {/* Base image */}
        <img
          src={`${BACKEND_URL}/uploaded_img/${currentImage.uploaded_img}`}
          alt="Uploaded"
          className="max-h-[70vh] max-w-[90vw] object-contain rounded-lg shadow"
        />

        {/* Overlay image */}
        {showOverlay && (
          <img
            src={`${BACKEND_URL}/processed_img/${currentImage.processed_img}`}
            alt="Processed overlay"
            className="absolute top-1/2 left-1/2 max-h-[70vh] max-w-[90vw] object-contain opacity-60 pointer-events-none -translate-x-1/2 -translate-y-1/2"
          />
        )}
      </div>
    </div>
  );
};

export default AnnotationPage;
