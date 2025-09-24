import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { ValidationPage } from "./pages/ValidationPage";
import SummaryPage from "./pages/SummaryPage";
import AnnotationPage from "./pages/AnnotationPage";
import { MetadataProvider, useMetadata } from "./context/MetadataContext";

function AppContent() {
  const { metadataFiles, setMetadataFiles, selectedMetadata, setSelectedMetadata } = useMetadata();

  useEffect(() => {
    fetch("http://localhost:8000/metadata/files")
      .then((res) => res.json())
      .then((data) => {
        setMetadataFiles(data.files || []);
      })
      .catch((err) => console.error("Error fetching metadata files:", err));
  }, [setMetadataFiles]);

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
        {/* <Route path="/annotate" element={<AnnotationPage />} /> */}
      </Routes>
    </Router>
  );
}

export default function App() {
  return (
    <MetadataProvider>
      <AppContent />
    </MetadataProvider>
  );
}
