import React, { useRef, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';

// Add available models
const AVAILABLE_MODELS = [
  { id: 'HQx1280', name: 'High Quality 1280px' },
  { id: 'modelv4_l_0.2', name: 'Model v4 Large' }
];

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

  // --- Upload handler ---
  const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file, file.name);
    });

    const response = await fetch('http://localhost:8000/upload-images', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    if (result.success) {
      alert(`Uploaded files: ${result.saved_files.join(', ')}`);
    } else {
      alert('Bulk upload failed');
    }
  };

  // --- Modified bulk detect handler with model selection ---
  const handleBulkDetect = async () => {
    try {
      setIsDetecting(true);
      const response = await fetch('http://localhost:8000/bulk-detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: selectedModel })
      });

      const result = await response.json();
      console.log(result);

      alert(`Processed ${result.processed} images!`);
      window.location.reload();
    } catch (error) {
      console.error("Detection failed", error);
      alert("Detection failed!");
    } finally {
      setIsDetecting(false);
    }
  };

  // --- Convert to YOLOv11 handler ---
  const handleConvertYOLOv11 = async () => {
    try {
      setIsConverting(true);
      const response = await fetch('http://localhost:8000/convert-yolov11', {
        method: 'POST',
      });

      const result = await response.json();
      console.log(result);

      alert(`✅ Conversion complete: ${result.output_path}`);
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
      const response = await fetch('http://localhost:8000/download-annotations', {
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

  // --- Clear folder with confirmation ---
  const clearFolder = async (folderType: string) => {
    // Show confirmation dialog
    const confirmed = window.confirm(`Are you sure you want to clear all ${folderType} images? This action cannot be undone.`);
    
    if (!confirmed) return;

    try {
      const response = await fetch(`http://localhost:8000/clear-folder/${folderType}`, {
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
        <div className="relative bg-white rounded-2xl shadow-2xl p-10 max-w-lg w-full text-center">
          {/* Spinner circle */}
          <div className="relative flex items-center justify-center mb-6">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-green-500 border-opacity-70"></div>
            <span className="absolute text-lg font-semibold text-gray-700">
              {progress}%
            </span>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            {isDetecting
              ? "Running Bulk Detection..."
              : "Converting to YOLOv11 Format..."}
          </h2>

          {/* Description */}
          <p className="text-gray-600 mb-6">
            {isDetecting
              ? `Processing images... (${progress})`
              : "Please wait while dataset is being converted."}
          </p>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-green-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
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
            className="ml-4 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
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
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={handleBulkDetect}
          >
            Run Detection
          </button>
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
