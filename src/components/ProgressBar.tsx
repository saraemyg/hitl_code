import React, { useRef, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import ConfirmModal from "../components/ConfirmModal";

// Add available models
const AVAILABLE_MODELS = [
  { id: 'modelv4_l_0.2', name: 'Model v4 Large' }
];

// Helper function to get API base URL (for Vite)
const getApiBase = () => { return import.meta.env.VITE_API_URL || "http://localhost:8000";};

interface ProgressBarProps {
  progress: number;
  current: number;
  total: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, current, total }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelMessage, setCancelMessage] = useState("");
  const controllerRef = useRef(null);

  // --- Lazy import HEIC conversion only in browser ---
  const convertHEIC = async (file: File) => {
    if (typeof window === "undefined") {
      throw new Error("HEIC conversion is only available in the browser.");
    }

    const heic2any = (await import("heic2any")).default;

    const result = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.9,
    });

    const blob = Array.isArray(result) ? result[0] : result;

    return new File([blob], file.name.replace(/\.heic$/i, ".jpg"), {
      type: "image/jpeg",
    });
  };

  // --- Upload handler ---
  const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();

    for (const file of Array.from(files)) {
      let uploadFile = file;

      if (file.name.toLowerCase().endsWith(".heic")) {
        try {
          uploadFile = await convertHEIC(file);
          console.log(`Converted ${file.name} → ${uploadFile.name}`);
        } catch (err) {
          console.error("HEIC conversion failed:", err);
          alert(`Failed to convert ${file.name}. Skipping.`);
          continue;
        }
      }

      formData.append("files", uploadFile, uploadFile.name);
    }

    try {
      const response = await fetch(`${getApiBase()}/upload-images`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (result.success) {
        alert(`✅ Uploaded files: ${result.saved_files.join(", ")}`);
      } else {
        alert("❌ Bulk upload failed");
      }
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed! Check console for details.");
    }
  };


  // --- bulk detect handler with model selection ---
  const handleBulkDetect = async () => {
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      setIsDetecting(true);
      const response = await fetch(`${getApiBase()}/bulk-detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel }),
        signal: controller.signal, // attach abort signal
      });

      const result = await response.json();
      console.log(result);

      alert(`Processed ${result.processed} images!`);
      window.location.reload();
    } catch (error) {
      if (error.name === "AbortError") {
        console.warn("Detection cancelled by user.");
        setCancelMessage("The detection process was cancelled before completion.");
        setShowCancelModal(true);
      } else {
        console.error("Detection failed", error);
        setCancelMessage("Detection failed due to an unexpected error.");
        setShowCancelModal(true);
      }
    } finally {
      setIsDetecting(false);
      controllerRef.current = null;
    }
  };

  const handleCancelDetect = () => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
  };

  // --- Convert to YOLOv11 handler ---
  const handleConvertYOLOv11 = async () => {
    try {
      setIsConverting(true);
      const response = await fetch(`${getApiBase()}/convert-yolov11`, {
        method: 'POST',
      });

      const result = await response.json();
      console.log(result);

      alert(`Conversion complete: ${result.output_path}`);
    } catch (error) {
      console.error("Conversion failed", error);
      alert("Conversion failed!");
    } finally {
      setIsConverting(false);
    }
  };

  // --- Download Yolov11 handler ---
  const handleDownloadAnnotations = async () => {
    try {
      const response = await fetch(`${getApiBase()}/download-annotations`, {
        method: 'GET',
      });

      if (!response.ok) throw new Error("Failed to download annotations");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = 'annotations.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed", error);
      alert("Download failed!");
    }
  };

  // --- Clear folder with confirmation --- > change to use ComfirmModal later ya!
  const clearFolder = async (folderType: string) => {
    // Show confirmation dialog
    const confirmed = window.confirm(`Are you sure you want to clear all ${folderType} images? This action cannot be undone.`);
    
    if (!confirmed) return;

    try {
      const response = await fetch(`${getApiBase()}/clear-folder/${folderType}`, {
        method: "DELETE",
      });

      const data = await response.json();
      alert(data.message || "Folder cleared successfully!");
      
      // Optionally refresh the page
      window.location.reload();
    } catch (error) {
      console.error("Error clearing folder:", error);
      alert("Failed to clear folder!");
    }
  };

  // Spinner / Loading Overlay
  if (isDetecting || isConverting) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="relative bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center border border-gray-200">
          
          {/* Animated ring spinner */}
          <div className="relative flex items-center justify-center mb-8">
            <div className="relative h-24 w-24">
              <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
              <div className="absolute inset-4 rounded-full bg-blue-100 animate-ping"></div>
              <div className="absolute inset-8 rounded-full bg-green-200 shadow-lg shadow-blue-400 animate-pulse flex items-center justify-center">
                <span className="text-3xl animate-bounce-slow">🤖</span>
              </div>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-700 mb-2">
            {isDetecting ? "Running Bulk Detection" : "Converting Dataset..."}
          </h2>

          {/* Description */}
          <p className="text-gray-500 text-sm mb-6">
            {isDetecting
              ? "Analyzing, detecting & classifying your plant images..."
              : "Reformatting dataset to YOLOv11 structure..."}
          </p>

          {/* Loading bar */}
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-200 to-blue-300 animate-progress"
              style={{
                width: `${progress || 100}%`,
                transition: "width 0.3s ease-in-out",
              }}
            ></div>
          </div>

          {isDetecting && (
            <button
              onClick={() => {
                if (window.confirm("Cancel ongoing detection?")) {
                  controllerRef.current?.abort(); // stop fetch
                  setIsDetecting(false);
                }
              }}
              className="mt-2 px-3 py-1 text-xs text-gray-500 hover:text-red-500 transition-colors"
            >
              Cancel Detection
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="bg-gray-200 rounded-full h-3 mb-4">
        <div 
          className="bg-gradient-to-r from-blue-500 to-red-500 h-3 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex justify-between items-center text-sm text-gray-600 mt-2">
        <span>Progress: {current}/{total}</span>
        <span>{progress.toFixed(1)}% Complete</span>

        {/* Upload */}
        <div className="flex items-center">
          <button
            className="ml-4 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-400"
            onClick={() => fileInputRef.current?.click()}
          >
            Upload Image
          </button>
          <button
            className="ml-1 p-2 bg-red-100 rounded hover:bg-red-200"
            onClick={() => clearFolder("uploaded")}
            title="Clear uploaded images"
          >
            <Trash2 size={16} className="text-red-600" />
          </button>
        </div>
        <input
          type="file"
          accept="image/*"
          multiple
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleBulkUpload}
        />

        {/* Model selector and detection buttons */}
        <div className="flex items-center gap-2">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="px-2 py-1 border rounded bg-white"
          >
            {AVAILABLE_MODELS.map(model => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
          
          <button
            onClick={handleBulkDetect}
            disabled={isDetecting}
            className="ml-4 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-400"
          >
            {isDetecting ? "Detecting..." : "Run Bulk Detection"}
          </button>

          {/* Optional cancel button */}
          {isDetecting && (
            <button
              onClick={handleCancelDetect}
              className="ml-4 px-6 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600"
            >
              Cancel Detection
            </button>
          )}

          {/* Cancel/Failure Confirmation Modal */}
          <ConfirmModal
            open={showCancelModal}
            title="Detection Notice"
            message={cancelMessage}
            confirmText="OK"
            cancelText="Close"
            onConfirm={() => setShowCancelModal(false)}
            onCancel={() => setShowCancelModal(false)}
          />

          <button
            className="p-2 bg-red-100 rounded hover:bg-red-200"
            onClick={() => clearFolder("processed")}
            title="Clear processed images"
          >
            <Trash2 size={16} className="text-red-600" />
          </button>
        </div>

        {/* Convert */}
        <div className="flex items-center">
          <button
            className="ml-4 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
            onClick={handleConvertYOLOv11}
          >
            Convert to YOLOv11 Format
          </button>
          <button
            className="ml-1 p-2 bg-red-100 rounded hover:bg-red-200"
            onClick={() => clearFolder("converted")}
            title="Clear converted files"
          >
            <Trash2 size={16} className="text-red-600" />
          </button>
        </div>

        {/* Download */}
        <button
          className="ml-4 p-2 bg-gray-200 rounded hover:bg-gray-300"
          onClick={handleDownloadAnnotations}
        >
          <Download size={18} className="text-gray-700" />
        </button>
      </div>
    </div>
  );
};
