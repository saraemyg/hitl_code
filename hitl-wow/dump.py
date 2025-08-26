# to do from boss : 
# check all combined dataset in roboflow ; cotyledon, special plants // progress : (200/2000)
# ->>>>>>>>>> focus on brownspot, burnedtip, wilting

# project flow to do :---------------------------------------
# - fix metadata format in processed_img  (/)
# - backend to save annotation changes (/) 
# - add button to convert metadata to yolov11 format (/)
# - add next/skip button & fix progress bar tracking 
# - if validated (show small '/' on corner top right)
# - progress is tracked only by status, must not be affected by 'next'(>>>>>>)

# - display image -> adjust full image settings (ImageViewer.tsx)
# - update the backend /bulk-detect so it writes metadata.json automatically every time you detect images
# - show bbox on full image (ImageViewer.tsx)
# - grid css prettify hheheheheheheh

#->>>>> add folder /database/

# - give summary after each bulk detections (100ms, 100files, 30 detections, 10 healthy images)

# - clear uploaded_img folder & processed_img folder-> delete function
# - cleanup: one css file for all components

# extra features not important : ----------------------------
# - delete duplicate images in uploaded_img folder
# - ability to adjust bounding box size (crop image) -> helper button to resize bbox
# - images in crops folder can be make into references image & color palette based on progress
# - another windows to see annotations review and summary, color palette 
# - ability to flag uncertain cases 
# - ability to hover and scroll in overall image 

# bugs : ----------------------------------------------------
# - each time it runs, it add images lol whatever with progress bar
# - certain bbox detection can have multiple defect
# - nms supression cases


#----------------------------------------------


import React, { useRef, useState } from 'react';
import { Download } from 'lucide-react';

interface ProgressBarProps {
  progress: number;
  current: number;
  total: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, current, total }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  // Upload handler
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

  // Bulk detect handler
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

  // Convert to YOLOv11 handler
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

  // Download YOLOv11 annotations
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

  // Spinner view
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
        <button
          className="ml-4 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={() => fileInputRef.current?.click()}
        >
          Upload Image
        </button>
        
        <input
          type="file"
          accept="image/*"
          multiple
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleBulkUpload}
        />

        <button
          className="ml-4 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={handleBulkDetect}
        >
          Run Detection
        </button>

        <button
          className="ml-4 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
          onClick={handleConvertYOLOv11}
        >
          Convert to YOLOv11 Format
        </button>

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
