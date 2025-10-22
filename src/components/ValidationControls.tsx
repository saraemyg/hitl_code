// src/components/ValidationControls.tsx
import React, { useState } from "react";
import { Check, AlertTriangle, Heart, HelpCircle, Trash2Icon} from "lucide-react";
import { DEFECT_CLASSES, Detection } from "../types";
import ConfirmModal from "../components/ConfirmModal";

export interface ValidationControlsProps {
  onValidate: (
    decision: "correct" | "healthy" | "other" | "uncertain" | "plantType",
    type?: string // optional, only when decision === "other"
  ) => void;
  currentDetection: Detection; // keep: so this component knows what to display
  goNextDetection: () => void; // keep: in case parent wants to handle navigation externally
  onDelete?: (crop: string) => void;
}

export const ValidationControls: React.FC<ValidationControlsProps> = ({
  onValidate,
  currentDetection,
  onDelete,
}) => {
  const [selectedClass, setSelectedClass] = useState(DEFECT_CLASSES[0]);
  const [selectedPlantType, setSelectedPlantType] = useState("CSBL");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const getApiBase = () => { return import.meta.env.VITE_API_URL || "http://localhost:8000"; };

  // validate detection + auto-advance
  const validateDetection = async (
    decision: "correct" | "healthy" | "other" | "uncertain" | "plantType",
    typeOrCode?: string
  ) => {
    if (!currentDetection) return;

    try {
      let body: any = { crop: currentDetection.crop, decision };

      if (decision === "other" && typeOrCode) {
        body.type = typeOrCode; // for defect
      } else if (decision === "plantType" && typeOrCode) {
        body.plant_type = { code: typeOrCode }; // for plant validation
      } else if (decision !== "plantType") {
        body.type = currentDetection.type; // normal case
      }

      const res = await fetch(`${getApiBase()}/detections/validate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to update detection");
      const updated = await res.json();
      console.log("✅ Validation updated:", updated);

      onValidate(decision, typeOrCode);
    } catch (err) {
      console.error("❌ Error updating detection:", err);
    }
  };

  // Delete handling 
  const handleDeleteConfirmed = async () => {
    if (!currentDetection) return;
    setIsDeleting(true);

    try {
      const body = { crop: currentDetection.crop };
      console.log("Deleting detection (frontend) for crop:", body.crop);

      const res = await fetch(`${getApiBase()}/detections/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null); // attempt to parse error message
        throw new Error(errBody?.detail || res.statusText || "Delete failed");
      }

      const result = await res.json();
      console.log(" Delete result:", result);

      // notify parent so the page can reload metadata / advance
      onDelete?.(currentDetection.crop || "");

      // close modal
      setShowDeleteModal(false);

      // // optionally advance UI if parent didn't
      // goNextDetection?.();
    } catch (err) {
      console.error("Error deleting detection:", err);
      alert("Failed to delete detection: " + (err as Error).message);
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentDetection) return;

      const key = e.key.toLowerCase();
      switch (key) {
        case "s":
          validateDetection("correct", currentDetection.type);
          break;
        case "q":
          validateDetection("uncertain", currentDetection.type);
          break;
        case "w":
          validateDetection("healthy", currentDetection.type);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentDetection]); // re-run effect when currentDetection changes


  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
      {/* Header with info tooltip + new Validate Plant Type dropdown */}
      <div className="flex items-center justify-between relative">
        {/* Left side: Info + text */}
        <div className="flex items-center gap-2">
          <p className="text-gray-600 text-left">Please validate this detection.</p>

          {/* Info button */}
          <div className="relative group">
            <button
              className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-sm font-bold"
              type="button"
            >
              i
            </button>
            {/* Tooltip — moved below to prevent clipping */}
            <div
              className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 opacity-0 
                        group-hover:opacity-100 transition-opacity duration-200 bg-gray-800 text-white 
                        text-xs rounded py-2 px-3 whitespace-pre-line z-[100] shadow-lg w-max max-w-xs"
            >
              <div className="text-left leading-relaxed">
                <strong>Keyboard Shortcuts:</strong>
                {"\n"}A: Prev Detection D: Next Detection
                {"\n"}S: Correct W: Healthy Q: Uncertain
                {"\n"}Space: Next Image
              </div>
            </div>
          </div>
        </div>

        {/* Validate Plant Type with dropdown */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => validateDetection("plantType", selectedPlantType)}
            className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-600 px-4 py-2 
                      rounded-lg font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
          >
            🌱 Validate Plant Type
          </button>

          {/* Dropdown for Plant Type */}
          <select
            value={selectedPlantType}
            onChange={(e) => setSelectedPlantType(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-400 
                      focus:border-transparent text-sm bg-white"
          >
            {Object.entries({
              CSBL: "Bright Lights Swiss Chard",
              KBSC: "Blue Scotch Kale",
              LBSS: "Lettuce Black Seeded Simpson",
              MBBC: "Baby Bok Choy",
              MGMZ: "Green Mizuna",
              RSLD: "Rocket Arugula",
            }).map(([code, label]) => (
              <option key={code} value={code}>
                {code} – {label}
              </option>
            ))}
          </select>
        </div>
      </div>


      {/* Validation buttons */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
        {/* Correct */}
        <button
          onClick={() => validateDetection("correct", currentDetection?.type)}
          className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-lg font-semibold transition-colors duration-200 shadow-md hover:shadow-lg"
        >
          <Check size={20} />
          Correct
        </button>

        {/* Healthy */}
        <button
          onClick={() => validateDetection("healthy", currentDetection?.type)}
          className="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold transition-colors duration-200 shadow-md hover:shadow-lg"
        >
          <Heart size={20} />
          Healthy
        </button>

        <div className="flex gap-2 col-span-3">
          {/* Uncertain */}
          <button
            onClick={() => validateDetection("uncertain", currentDetection?.type)}
            className="flex items-center justify-center bg-yellow-500 hover:bg-red-600 text-white p-3 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
            title="Uncertain Detection"
          >
            <HelpCircle size={20} />
          </button>

          {/* Other */}
          <button
            onClick={() => validateDetection("other", selectedClass)}
            className="flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 shadow-md hover:shadow-lg"
          >
            <AlertTriangle size={18} />
            Other
          </button>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
          >
            {DEFECT_CLASSES.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>

          {/* Delete button */}
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center justify-center bg-red-500 hover:bg-red-600 text-white p-3 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
            title="Delete Detection"
            disabled={!currentDetection}
          >
            <Trash2Icon size={20} />
          </button>

          {/* Comfrimation Modal */}
           <ConfirmModal
            open={showDeleteModal}
            title="Delete detection?"
            message={`Delete detection "${currentDetection?.type}"? This cannot be undone.`}
            confirmText={isDeleting ? "Deleting..." : "Delete"}
            cancelText="Cancel"
            onConfirm={handleDeleteConfirmed}
            onCancel={() => setShowDeleteModal(false)}
          />
          
        </div>
      </div>

    </div>
  );
};

export default ValidationControls;
