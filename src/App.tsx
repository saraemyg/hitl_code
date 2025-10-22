import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { ValidationPage } from "./pages/ValidationPage";
import SummaryPage from "./pages/SummaryPage";
import { MetadataProvider, useMetadata } from "./context/MetadataContext";
import { BarChart2, CheckCircle, Menu, X } from "lucide-react";

function Navigation() {
  const location = useLocation();
  const { metadataFiles, selectedMetadata, setSelectedMetadata } = useMetadata();
  const [isOpen, setIsOpen] = useState(false); // toggle menu

  return (
    <nav className="bg-white border-b border-gray-200 p-3 flex items-center justify-between shadow-sm relative">
      {/* Left side: Toggle + Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="p-2 rounded-md hover:bg-gray-100"
          title="Toggle navigation"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Right side: Metadata Selector */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-700 hidden sm:block">Metadata:</label>
        <select
          value={selectedMetadata || ""}
          onChange={(e) => setSelectedMetadata(e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          {metadataFiles.map((file) => (
            <option key={file} value={file}>
              {file}
            </option>
          ))}
        </select>
      </div>

      {/* Floating menu (appears when ☰ clicked) */}
      {isOpen && (
        <div className="absolute left-3 top-14 bg-white border border-gray-200 rounded-lg shadow-md p-3 flex flex-col gap-2 w-36 z-50">
          <Link
            to="/"
            className={`flex items-center gap-2 p-2 rounded-md text-sm ${
              location.pathname === "/"
                ? "bg-blue-100 text-blue-600"
                : "hover:bg-gray-100 text-gray-700"
            }`}
            onClick={() => setIsOpen(false)}
          >
            <BarChart2 className="w-4 h-4" /> Summary
          </Link>
          <Link
            to="/validate"
            className={`flex items-center gap-2 p-2 rounded-md text-sm ${
              location.pathname === "/validate"
                ? "bg-green-100 text-green-600"
                : "hover:bg-gray-100 text-gray-700"
            }`}
            onClick={() => setIsOpen(false)}
          >
            <CheckCircle className="w-4 h-4" /> Validation
          </Link>
        </div>
      )}
    </nav>
  );
}

function AppContent() {
  const { metadataFiles, setMetadataFiles, selectedMetadata, setSelectedMetadata } = useMetadata();
  const API_BASE = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    if (!API_BASE) return;
    fetch(`${API_BASE}/metadata/files`)
      .then((res) => res.json())
      .then((data) => {
        const files = data.files || [];
        setMetadataFiles(files);
        if (files.length && !selectedMetadata) setSelectedMetadata(files[0]);
      })
      .catch((err) => console.error("Error fetching metadata files:", err));
  }, [setMetadataFiles, selectedMetadata, API_BASE]);

  return (
    <Router>
      <Navigation />
      <main className="p-4">
        <Routes>
          <Route path="/" element={<SummaryPage />} />
          <Route path="/validate" element={<ValidationPage />} />
        </Routes>
      </main>
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
