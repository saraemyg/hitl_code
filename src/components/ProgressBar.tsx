import React, { useRef, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';

interface ProgressBarProps {
  progress: number;
  current: number;
  total: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, current, total }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

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

  // --- Bulk detect handler ---
  const handleBulkDetect = async () => {
    try {
      setIsDetecting(true); // show spinner
      const response = await fetch('http://localhost:8000/bulk-detect', {
        method: 'POST'
      });

      const result = await response.json();
      console.log(result);

      alert(`Processed ${result.processed} images!`);

      // refresh the page after detection
      window.location.reload();
    } catch (error) {
      console.error("Detection failed", error);
      alert("Detection failed!");
    } finally {
      setIsDetecting(false); // hide spinner
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

  const clearFolder = async (folderType) => {
    try {
      const response = await fetch(`http://localhost:8000/clear-folder/${folderType}`, {
        method: "DELETE",
      });

      const data = await response.json();
      alert(data.message || "Something happened!");
    } catch (error) {
      console.error("Error clearing folder:", error);
      alert("Failed to clear folder!");
    }
  };

  // Spinner view -> please fix this haha buruk namam
  if (isDetecting || isConverting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-lg shadow-xl p-12 max-w-md">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            {isDetecting ? "Running bulk detection..." : "Converting to YOLOv11 format..."}
          </h2>
          <p className="text-gray-600">
            {isDetecting
              ? "Please wait while AI processes your images."
              : "Please wait while dataset is being converted."}
          </p>    
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="bg-gray-200 rounded-full h-3 mb-4">
        <div 
          className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-300 ease-out"
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

        {/* Run detection */}
        <div className="flex items-center">
          <button
            className="ml-4 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={handleBulkDetect}
          >
            Run Detection
          </button>
          <button
            className="ml-1 p-2 bg-red-100 rounded hover:bg-red-200"
            onClick={() => clearFolder("processed")}
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
