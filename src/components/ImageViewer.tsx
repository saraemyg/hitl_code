import React, { useRef, useState, useEffect } from "react";
import { Sun, Palette, Eye, EyeOff } from "lucide-react";
import { Detection } from "../types";

interface ImageViewerProps {
  imageSrc: string;
  detections?: Detection[];
  zoomable?: boolean;
  showBBoxes?: boolean;
  currentDetection?: Detection | null;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  imageSrc,
  detections = [],
  zoomable = true,
  showBBoxes = true,
  currentDetection = null, // default: no highlighted detection
}) => {
  // --- PAN + ZOOM STATES ---
  const [scale, setScale] = useState(1.5); // default zoom-in for nicer presentation
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startDrag, setStartDrag] = useState({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });

  // --- IMAGE & CANVAS REFS ---
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgNatural, setImgNatural] = useState({ width: 1, height: 1 });

  // --- ADJUSTMENT & UI STATES ---
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [showAdjustPanel, setShowAdjustPanel] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [palettePosition, setPalettePosition] = useState({ x: 40, y: 40 });
  const [isDraggingPalette, setIsDraggingPalette] = useState(false);
  const paletteDragStart = useRef({ x: 0, y: 0 });
  const [showAllDetections, setShowAllDetections] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Inertia for dragging
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

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomable && scale > 1) {
      setIsDragging(true);
      setStartDrag({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomable) {
      const newOffset = { x: e.clientX - startDrag.x, y: e.clientY - startDrag.y };
      velocity.current = {
        x: newOffset.x - offset.x,
        y: newOffset.y - offset.y,
      };
      setOffset(newOffset);
    }
    if (isDraggingPalette) {
      setPalettePosition({
        x: e.clientX - paletteDragStart.current.x,
        y: e.clientY - paletteDragStart.current.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsDraggingPalette(false);
  };

  const handleDoubleClick = () => {
    if (zoomable) {
      setScale(1.5); // reset to nice zoom level
      setOffset({ x: 0, y: 0 });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!zoomable) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const newScale = Math.min(Math.max(scale + delta, 1), 5);
    setScale(newScale);
  };

  const handlePaletteMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDraggingPalette(true);
    paletteDragStart.current = {
      x: e.clientX - palettePosition.x,
      y: e.clientY - palettePosition.y,
    };
  };

  const handleResetAdjustments = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
  };

  const handleImageLoad = () => {
    if (imgRef.current) {
      setImgNatural({
        width: imgRef.current.naturalWidth,
        height: imgRef.current.naturalHeight,
      });
      // keep default zoom aesthetic (you can adjust or compute fit if desired)
      setScale(1.5);
      setOffset({ x: 0, y: 0 });
    }
  };

  // --- keyboard shortcut for toggling label visibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "n") {
        setShowAllDetections((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!showBBoxes) return;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // --- prepare canvas size
    const containerRect = canvas.getBoundingClientRect();
    canvas.width = containerRect.width;
    canvas.height = containerRect.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- aspect ratio & offset logic
    const imgAspect = imgNatural.width / imgNatural.height;
    const containerAspect = containerRect.width / containerRect.height;
    let renderWidth, renderHeight, offsetX, offsetY;

    if (imgAspect > containerAspect) {
      renderWidth = containerRect.width;
      renderHeight = containerRect.width / imgAspect;
      offsetX = 0;
      offsetY = (containerRect.height - renderHeight) / 2;
    } else {
      renderHeight = containerRect.height;
      renderWidth = containerRect.height * imgAspect;
      offsetX = (containerRect.width - renderWidth) / 2;
      offsetY = 0;
    }

    // --- Base color palette (cyclic, dynamic by detection id)
    const COLORS = [
      "#b3f2ee", // teal
      "#fac184", // brown
      "#ed9da6", // pink
      "#95b9de", // blue
      "#c895de", // purple
      "#82ca9d", // sage green
      "#f7dd72", // yellow
    ];

    // --- apply transforms for zoom/pan
    ctx.save();
    ctx.translate(offset.x + canvas.width / 2, offset.y + canvas.height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    // --- helper function to draw each detection
    function drawDetection(det: any, isCurrent: boolean) {
      const [x, y, w, h] = det.bbox as [number, number, number, number];
      const absX = x * renderWidth + offsetX;
      const absY = y * renderHeight + offsetY;
      const boxW = w * renderWidth;
      const boxH = h * renderHeight;
      const x1 = absX - boxW / 2;
      const y1 = absY - boxH / 2;

      const colorIndex = det.id % COLORS.length;
      const baseColor = COLORS[colorIndex];

      // --- stroke settings (box outline)
      ctx.strokeStyle = isCurrent ? "#ffffff" : baseColor;
      ctx.lineWidth = isCurrent ? 2.5 : 1.2;
      ctx.strokeRect(x1, y1, boxW, boxH);

      // --- LABEL VISIBILITY: only currentDetection or when showAllDetections
      if (showAllDetections || isCurrent) {
        const label = `${det.type} ${(det.conf * 100).toFixed(1)}%`;
        const fontSize = Math.max(10, 12 / scale);
        ctx.font = `${fontSize}px 'Segoe UI', sans-serif`;

        const textWidth = ctx.measureText(label).width;
        const padding = 3 / scale;
        const textHeight = fontSize + 4 / scale;

        // Label background box 
        ctx.fillStyle = isCurrent ? "#ffffffff" : baseColor;
        ctx.fillRect(x1, y1 - textHeight, textWidth + padding * 2, textHeight);

        // --- Label text color
        ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
        ctx.fillText(label, x1 + padding, y1 - 4 / scale);
      }
    }

    // --- draw all other detections first
    detections.forEach((det) => {
      if (det !== currentDetection) {
        drawDetection(det, false);
      }
    });

    // --- draw current detection last (on top)
    if (currentDetection) {
      drawDetection(currentDetection, true);
    }

    ctx.restore();
  }, [
    detections,
    offset,
    scale,
    imageSrc,
    imgNatural,
    showBBoxes,
    showAllDetections,
    currentDetection,
  ]);


  return (
    <div
      className={`relative bg-gray-100 rounded-lg overflow-hidden flex justify-center items-center`}
      style={{ height: "450px", cursor: zoomable ? "grab" : "default" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    >
      <img
        ref={imgRef}
        src={imageSrc}
        onLoad={handleImageLoad}
        alt="Processed plant"
        className="select-none w-full h-full object-contain"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: "center center",
          transition: isDragging ? "none" : "transform 0.2s ease-out",
          filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`,
          pointerEvents: "none",
        }}
      />

      {showBBoxes && (
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
        />
      )}

      {/* Toolbar */}
      {zoomable && (
        <div className="absolute bottom-3 left-3 bg-white/85 rounded-lg px-3 py-2 shadow-md flex items-center gap-3 backdrop-blur-sm border border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Zoom</span>
            <input
              type="range"
              min="1"
              max="5"
              step="0.1"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-24 accent-green-600"
            />
          </div>

          <button
            onClick={() => setShowAdjustPanel((prev) => !prev)}
            className={`p-1.5 rounded-full transition ${
              showAdjustPanel ? "bg-yellow-200" : "bg-gray-200"
            }`}
          >
            <Sun size={16} className="text-gray-700" />
          </button>

          <button
            onClick={() => setShowPalette((prev) => !prev)}
            className={`p-1.5 rounded-full transition ${
              showPalette ? "bg-blue-200" : "bg-gray-200"
            }`}
          >
            <Palette size={16} className="text-gray-700" />
          </button>

          <button
            onClick={() => setShowAllDetections((prev) => !prev)}
            className={`relative p-1.5 rounded-full transition ${
              showAllDetections ? "bg-green-200" : "bg-gray-200"
            }`}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            {showAllDetections ? (
              <Eye className="text-gray-700" size={16} />
            ) : (
              <EyeOff className="text-gray-700" size={16} />
            )}
            {showTooltip && (
              <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded-md shadow-md whitespace-nowrap opacity-90">
                {showAllDetections ? "Hide all detections" : "Show all detections"}
              </span>
            )}
          </button>

        </div>
      )}

      {/* Adjustment Panel */}
      {showAdjustPanel && (
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

      {/* Movable Palette */}
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
