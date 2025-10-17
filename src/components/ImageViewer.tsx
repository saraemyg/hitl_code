import React, { useRef, useState, useEffect } from "react";
import { Sun, Palette } from "lucide-react";
import { Detection } from "../types";

interface ImageViewerProps {
  imageSrc: string;
  detection?: Detection;
  className?: string;
  zoomable?: boolean; // Enable zoom & adjustment features
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  imageSrc,
  className = "",
  zoomable = false,
}) => {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startDrag, setStartDrag] = useState({ x: 0, y: 0 });
  const [showAdjustPanel, setShowAdjustPanel] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [palettePosition, setPalettePosition] = useState({ x: 40, y: 40 });
  const [isDraggingPalette, setIsDraggingPalette] = useState(false);
  const paletteDragStart = useRef({ x: 0, y: 0 });

  const velocity = useRef({ x: 0, y: 0 });

  // Image adjustments
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);

  const imgRef = useRef<HTMLImageElement>(null);

  // Smooth dragging inertia
  useEffect(() => {
    let animationFrame: number;
    const animate = () => {
      if (!isDragging) {
        setOffset((prev) => ({
          x: prev.x + velocity.current.x,
          y: prev.y + velocity.current.y,
        }));
        velocity.current.x *= 0.9;
        velocity.current.y *= 0.9;
        if (
          Math.abs(velocity.current.x) < 0.01 &&
          Math.abs(velocity.current.y) < 0.01
        ) {
          velocity.current = { x: 0, y: 0 };
        } else {
          animationFrame = requestAnimationFrame(animate);
        }
      } else {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [isDragging]);

  // Keyboard zoom (↑ ↓)
  useEffect(() => {
    if (!zoomable) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") setScale((prev) => Math.min(prev * 1.1, 5));
      else if (e.key === "ArrowDown") setScale((prev) => Math.max(prev * 0.9, 1));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zoomable]);

  // Mouse drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomable && scale > 1) {
      setIsDragging(true);
      setStartDrag({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (zoomable && isDragging) {
      const newOffset = { x: e.clientX - startDrag.x, y: e.clientY - startDrag.y };
      velocity.current = {
        x: newOffset.x - offset.x,
        y: newOffset.y - offset.y,
      };
      setOffset(newOffset);
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // Double-click resets zoom
  const handleDoubleClick = () => {
    if (zoomable) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
    }
  };

  // Zoom slider
  const handleZoomSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (zoomable) setScale(parseFloat(e.target.value));
  };

  // Reset adjustments
  const handleResetAdjustments = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
  };

  // Handle palette drag
  const handlePaletteMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDraggingPalette(true);
    paletteDragStart.current = {
      x: e.clientX - palettePosition.x,
      y: e.clientY - palettePosition.y,
    };
  };

  const handlePaletteMouseMove = (e: React.MouseEvent) => {
    if (isDraggingPalette) {
      setPalettePosition({
        x: e.clientX - paletteDragStart.current.x,
        y: e.clientY - paletteDragStart.current.y,
      });
    }
  };

  const handlePaletteMouseUp = () => setIsDraggingPalette(false);

  return (
    <div
      className={`relative bg-gray-100 rounded-lg overflow-hidden flex justify-center items-center ${className}`}
      style={{
        height: "400px",
        cursor: zoomable && scale > 1 ? "grab" : "default",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={(e) => {
        handleMouseMove(e);
        handlePaletteMouseMove(e);
      }}
      onMouseUp={() => {
        handleMouseUp();
        handlePaletteMouseUp();
      }}
      onMouseLeave={() => {
        handleMouseUp();
        handlePaletteMouseUp();
      }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Main Image */}
      <img
        ref={imgRef}
        src={imageSrc}
        alt="Plant detection"
        className="select-none w-full h-full object-cover"
        style={{
          transform: zoomable
            ? `translate(${offset.x}px, ${offset.y}px) scale(${scale})`
            : "none",
          transformOrigin: "center center",
          transition: isDragging ? "none" : "transform 0.2s ease-out",
          pointerEvents: "none",
          filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`,
        }}
      />

      {/* Bottom-left toolbar */}
      {zoomable && (
        <div className="absolute bottom-3 left-3 bg-white/80 rounded-lg px-3 py-2 shadow-md flex items-center gap-3 backdrop-blur-sm">
          {/* Zoom slider */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Zoom</span>
            <input
              type="range"
              min="1"
              max="5"
              step="0.1"
              value={scale}
              onChange={handleZoomSlider}
              className="w-24 accent-green-600"
            />
          </div>

          {/* Adjust button */}
          <button
            onClick={() => setShowAdjustPanel((prev) => !prev)}
            className={`p-1.5 rounded-full transition ${
              showAdjustPanel
                ? "bg-yellow-200 hover:bg-yellow-300"
                : "bg-gray-200 hover:bg-gray-300"
            }`}
            title="Adjust brightness / contrast / saturation"
          >
            <Sun size={16} className="text-gray-700" />
          </button>

          {/* Palette toggle button */}
          <button
            onClick={() => setShowPalette((prev) => !prev)}
            className={`p-1.5 rounded-full transition ${
              showPalette
                ? "bg-blue-200 hover:bg-blue-300"
                : "bg-gray-200 hover:bg-gray-300"
            }`}
            title="Show Color Palette"
          >
            <Palette size={16} className="text-gray-700" />
          </button>
        </div>
      )}

      {/* Adjustment Panel */}
      {zoomable && showAdjustPanel && (
        <div className="absolute bottom-16 left-3 bg-white/95 rounded-lg shadow-lg p-3 flex flex-col gap-2 w-52 border border-gray-200 backdrop-blur-md">
          {[
            { label: "Brightness", value: brightness, setter: setBrightness },
            { label: "Contrast", value: contrast, setter: setContrast },
            { label: "Saturation", value: saturation, setter: setSaturation },
          ].map((adj) => (
            <div key={adj.label} className="relative">
              <label className="text-xs text-gray-600">{adj.label}</label>
              <input
                type="range"
                min="50"
                max="150"
                value={adj.value}
                onChange={(e) => adj.setter(Number(e.target.value))}
                className="w-full accent-yellow-500"
              />
              {/* Origin mark */}
              <div className="absolute top-1/2 left-1/2 w-[2px] h-3 bg-gray-400 opacity-50 -translate-x-1/2 -translate-y-1/2"></div>
            </div>
          ))}
          <button
            onClick={handleResetAdjustments}
            className="text-xs text-gray-700 mt-2 border border-gray-300 rounded-md px-2 py-1 hover:bg-gray-100 transition"
          >
            Reset
          </button>
        </div>
      )}

      {/* Movable Color Palette */}
      {showPalette && (
        <div
          className="absolute bg-white/90 border border-gray-300 rounded-lg shadow-lg p-2 cursor-move w-52"
          style={{
            left: `${palettePosition.x}px`,
            top: `${palettePosition.y}px`,
            transition: isDraggingPalette ? "none" : "transform 0.1s ease",
          }}
          onMouseDown={handlePaletteMouseDown}
        >
          <p className="text-xs text-gray-600 mb-1 font-medium text-center">
            Colour Palette
          </p>
          <div className="aspect-[4/3] overflow-hidden rounded">
            <img
              src="/all_classes_palette.png"
              alt="All Classes Palette"
              className="w-full h-full object-cover rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
};
