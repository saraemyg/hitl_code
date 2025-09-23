import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { ValidationPage } from './pages/ValidationPage';
import SummaryPage from './pages/SummaryPage';
import AnnotationPage from './pages/AnnotationPage';

function App() {
  const [metadataFiles, setMetadataFiles] = useState<string[]>([]);
  const [selectedMetadata, setSelectedMetadata] = useState<string>("");

  useEffect(() => {
    // Fetch available metadata files from backend
    fetch("http://localhost:8000/metadata/files")
      .then((res) => res.json())
      .then((data) => {
        setMetadataFiles(data.files || []);
        if (data.files && data.files.length > 0) {
          setSelectedMetadata(data.files[0]); // default selection
        }
      })
      .catch((err) => console.error("Error fetching metadata files:", err));
  }, []);

  return (
    <Router>
      {/* Navigation Bar */}
      <nav className="bg-gray-100 p-4 flex gap-4 items-center">
        <Link to="/" className="font-semibold text-blue-600">
          Summary
        </Link>
        <Link to="/validate" className="font-semibold text-green-600">
          Validation
        </Link>

        {/* Metadata Selector */}
        <div className="ml-auto">
          <label className="mr-2 font-medium text-gray-700">Metadata:</label>
          <select
            value={selectedMetadata}
            onChange={(e) => setSelectedMetadata(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1"
          >
            {metadataFiles.map((file) => (
              <option key={file} value={file}>
                {file}
              </option>
            ))}
          </select>
        </div>
      </nav>

      {/* Routes */}
      <Routes>
      <Route path="/" element={<SummaryPage />} />
      <Route path="/validate" element={<ValidationPage />} />
    </Routes>
    </Router>
  );
}

export default App;
