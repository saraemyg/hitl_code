import React, { useRef } from 'react';

interface ProgressBarProps {
  progress: number;
  current: number;
  total: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, current, total }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // This function will be called when a file is selected
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

  const handleBulkDetect = async () => {
    const response = await fetch('http://localhost:8000/bulk-detect', {
      method: 'POST'
    });
    const result = await response.json();
    console.log(result);
    alert(`Processed ${result.processed} images!`);
  };

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

      </div>
    </div>
  );
};