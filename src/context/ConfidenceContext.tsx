// src/context/ConfidenceContext.tsx
import React, { createContext, useContext, useState } from "react";

interface ConfidenceContextType {
  confidenceThreshold: number;
  setConfidenceThreshold: (value: number) => void;
}

const ConfidenceContext = createContext<ConfidenceContextType | undefined>(undefined);

export const ConfidenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5); // default 0.5
  return (
    <ConfidenceContext.Provider value={{ confidenceThreshold, setConfidenceThreshold }}>
      {children}
    </ConfidenceContext.Provider>
  );
};

export const useConfidence = (): ConfidenceContextType => {
  const context = useContext(ConfidenceContext);
  if (!context) throw new Error("useConfidence must be used within ConfidenceProvider");
  return context;
};
