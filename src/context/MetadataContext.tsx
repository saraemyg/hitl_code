import React, { createContext, useContext, useState, useEffect } from "react";

interface MetadataContextType {
  selectedMetadata: string;
  setSelectedMetadata: (value: string) => void;
  metadataFiles: string[];
  setMetadataFiles: (files: string[]) => void;
}

const MetadataContext = createContext<MetadataContextType | undefined>(undefined);

export const MetadataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [metadataFiles, setMetadataFiles] = useState<string[]>([]);
  
  // Load initial selectedMetadata from localStorage (if exists)
  const [selectedMetadata, setSelectedMetadataState] = useState<string>(() => {
    return localStorage.getItem("selectedMetadata") || "";
  });

  // Wrap setter so it also updates localStorage
  const setSelectedMetadata = (value: string) => {
    setSelectedMetadataState(value);
    localStorage.setItem("selectedMetadata", value);
  };

  // If nothing stored yet, set default when files arrive
  useEffect(() => {
    if (metadataFiles.length > 0 && !selectedMetadata) {
      setSelectedMetadata(metadataFiles[0]); // pick first available file
    }
  }, [metadataFiles, selectedMetadata]);

  return (
    <MetadataContext.Provider
      value={{ selectedMetadata, setSelectedMetadata, metadataFiles, setMetadataFiles }}
    >
      {children}
    </MetadataContext.Provider>
  );
};

export const useMetadata = () => {
  const context = useContext(MetadataContext);
  if (!context) {
    throw new Error("useMetadata must be used within a MetadataProvider");
  }
  return context;
};
