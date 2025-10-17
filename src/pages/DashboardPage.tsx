import React, { useMemo, useState } from "react";
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer, Line, ComposedChart } from "recharts";
import { Detection, DEFECT_CLASSES, ImageData } from "../types";
import { useDetectionData } from "../hooks/useDetectionData";

// Interfaces
interface PieLabel {
  name: string;
  percent: number;
}

// Chart color palettes
const COLORS = [
  "#b3f2ee", // teal
  "#fac184", // brown
  "#ed9da6", // pink
  "#95b9de", // blue
  "#c895de", // purple
  "#82ca9d", // sage green
  "#f7dd72", // yellow
];

const STATUS_COLORS: Record<string, string> = {
  Validated: "#82ca9d", // green
  Unvalidated: "#e7bfc3ff", // pink
  Healthy: "#95b9de", // blue
  Uncertain: "#f7dd72", // yellow
};

const DashboardPage: React.FC = () => {
  const { data, loading, error } = useDetectionData(); // unified data fetch
  const [selectedData, setSelectedData] = useState<"defect" | "status" | "plant">("defect");

  // Compute aggregated data only once when `data` changes
  const { defectCounts, validationStatus, plantTypeCounts } = useMemo(() => {
    const typeCount: Record<string, number> = {};
    const typeConfidence: Record<string, number[]> = {};
    const statusCount: Record<string, number> = {
      validated: 0,
      unvalidated: 0,
      healthy: 0,
      uncertain: 0,
    };
    const plantCount: Record<string, { count: number; confs: number[] }> = {};

    data.forEach((item: ImageData) => {
      // Aggregate Plant Type
      const plantLabel = item.plant_type?.label || "Unknown";
      const plantConf = item.plant_type?.conf || 0;

      if (!plantCount[plantLabel]) plantCount[plantLabel] = { count: 0, confs: [] };
      plantCount[plantLabel].count += 1;
      plantCount[plantLabel].confs.push(plantConf);

      // Aggregate detections
      item.detections.forEach((det: Detection) => {
        typeCount[det.type] = (typeCount[det.type] || 0) + 1;
        if (!typeConfidence[det.type]) typeConfidence[det.type] = [];
        typeConfidence[det.type].push(det.conf);

        if (det.status === "validated") statusCount.validated++;
        else if (det.status === "healthy") statusCount.healthy++;
        else if (det.status === "uncertain") statusCount.uncertain++;
        else statusCount.unvalidated++;
      });
    });

    // Prepare sorted defect counts with average confidence
    const sortedDefects = Object.entries(typeCount).map(([name, value]) => {
      const confs = typeConfidence[name] || [];
      const avgConfidence = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0;
      return { name, value, avgConfidence };
    }).sort((a, b) => b.value - a.value);

    // Sorted validation status
    const sortedStatus = Object.entries(statusCount).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    })).sort((a, b) => b.value - a.value);

    // Sorted plant type counts with average confidence
    const sortedPlants = Object.entries(plantCount).map(([name, { count, confs }]) => ({
      name,
      value: count,
      avgConfidence: confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0,
    })).sort((a, b) => b.value - a.value);

    return { defectCounts: sortedDefects, validationStatus: sortedStatus, plantTypeCounts: sortedPlants };
  }, [data]);


  const DEFECT_COLORS: Record<string, string> = useMemo(() => {
    return DEFECT_CLASSES.reduce((acc, cls, i) => {
      acc[cls] = COLORS[i % COLORS.length];
      return acc;
    }, {} as Record<string, string>);
  }, []);

  const chartData = selectedData === "defect" ? defectCounts : validationStatus;
  const colorSource =
    selectedData === "defect" ? DEFECT_COLORS : STATUS_COLORS;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh] text-gray-500">
        Loading dashboard data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-[60vh] text-red-500">
        Failed to load dashboard: {error.message}
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 h-[60vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">Dashboard Overview</h1>
        <select
          value={selectedData}
          onChange={(e) => setSelectedData(e.target.value as "defect" | "status")}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="defect">Defect Types</option>
          <option value="status">Validation Status</option>
          <option value="plant">Plant Types</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Pie Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center md:justify-between">
          {/* Left Pie Chart */}
          <div className="w-full md:w-2/3 h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={130}
                  labelLine={true}
                  label={({ percent }: PieLabel) => `${(percent * 100).toFixed(1)}%`}
                >
                  {chartData.map((entry, index) => {
                    const baseColor =
                      selectedData === "status"
                        ? STATUS_COLORS[entry.name] || "#ccc"
                        : DEFECT_COLORS[entry.name] || "#ccc";
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={`url(#grad-${index})`}
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    );
                  })}
                </Pie>

                {/* Gradient Definitions */}
                <defs>
                  {chartData.map((entry, index) => {
                    const baseColor =
                      selectedData === "status"
                        ? STATUS_COLORS[entry.name] || "#ccc"
                        : DEFECT_COLORS[entry.name] || "#ccc";
                    return (
                      <linearGradient
                        key={`grad-${index}`}
                        id={`grad-${index}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor={baseColor} stopOpacity={0.8} />
                        <stop offset="100%" stopColor={baseColor} stopOpacity={1} />
                      </linearGradient>
                    );
                  })}
                </defs>

                <Tooltip
                  formatter={(value: number, name: string) => {
                    const total = chartData.reduce((sum, item) => sum + item.value, 0);
                    const percent = ((value / total) * 100).toFixed(1);
                    return [`${percent}%`, name];
                  }}
                  contentStyle={{
                    borderRadius: "10px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    fontSize: "0.85rem",
                  }}
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Right Compact Legend */}
          <div className="md:w-1/3 mt-6 md:mt-0 md:pl-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Distribution</h2>
            <ul className="space-y-1.5 text-xs">
              {chartData.map((entry, index) => {
                const baseColor =
                  selectedData === "status"
                    ? STATUS_COLORS[entry.name] || "#ccc"
                    : DEFECT_COLORS[entry.name] || "#ccc";
                const total = chartData.reduce((sum, item) => sum + item.value, 0);
                const percent = ((entry.value / total) * 100).toFixed(1);
                return (
                  <li key={`legend-${index}`} className="flex items-center space-x-2">
                    <span
                      className="block w-3 h-3 rounded"
                      style={{
                        background: `linear-gradient(to bottom, ${baseColor}88, ${baseColor})`,
                      }}
                    ></span>
                    <span className="text-gray-600 truncate">
                      {entry.name} — {percent}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

      {/* Bar + Line Chart (Vertical) */}
      <div className="bg-white p-6 rounded-2xl shadow-lg">
        <h2 className="text-m font-semibold text-gray-700 mb-6 text-center">
          {selectedData === "defect"
            ? "Defect Frequency & Avg Confidence"
            : "Validation Progress (Sorted)"}
        </h2>

        <div className="w-full h-[420px] flex items-center justify-center">
          <ResponsiveContainer width="95%" height="100%">
            {selectedData === "defect" ? (
              <ComposedChart
                data={chartData}
                margin={{ top: 20, right: 50, left: 20, bottom: 60 }}
              >
                <CartesianGrid stroke="#f0f0f0" strokeDasharray="3 3" />

                {/* Gradients */}
                <defs>
                  {chartData.map((entry) => (
                    <linearGradient
                      key={`grad-${entry.name}`}
                      id={`grad-${entry.name}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor={DEFECT_COLORS[entry.name]}
                        stopOpacity={0.9}
                      />
                      <stop
                        offset="100%"
                        stopColor={DEFECT_COLORS[entry.name]}
                        stopOpacity={0.6}
                      />
                    </linearGradient>
                  ))}

                  {/* Dual-color gradient for confidence line */}
                  <linearGradient id="confidenceGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#22c55e" /> {/* green */}
                    <stop offset="50%" stopColor="#facc15" /> {/* yellow */}
                    <stop offset="100%" stopColor="#ef4444" /> {/* red */}
                  </linearGradient>
                </defs>

                {/* X-axis = Defect type */}
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#444", fontWeight: 500, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                />

                {/* Left axis = Count */}
                <YAxis
                  yAxisId="left"
                  tick={{ fill: "#666", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  label={{
                    value: "Detection Count",
                    angle: -90,
                    position: "insideLeft",
                    offset: -5,
                    style: { fill: "#888", fontSize: 11, fontWeight: 500 },
                  }}
                />

                {/* Right axis = Confidence (%) */}
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  tick={{ fill: "#666", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  label={{
                    value: "Avg Confidence (%)",
                    angle: 90,
                    position: "insideRight",
                    offset: -5,
                    style: { fill: "#888", fontSize: 11, fontWeight: 500 },
                  }}
                />

                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.05)" }}
                  contentStyle={{
                    backgroundColor: "#fff",
                    borderRadius: "10px",
                    border: "1px solid #eee",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
                    fontSize: "0.85rem",
                  }}
                  formatter={(value: any, name: string, props: any) => {
                    const { dataKey } = props; // <-- guaranteed access to correct key
                    if (dataKey === "avgConfidence") {
                      return [`${(value * 100).toFixed(2)}%`, "Avg Confidence"];
                    }
                    if (dataKey === "value") {
                      return [value, "Detection Count"];
                    }
                    return [value, name];
                  }}
                  labelFormatter={(label: string) => `Defect: ${label}`}
                />

                {/* Bars for detection count */}
                <Bar
                  yAxisId="left"
                  dataKey="value"
                  radius={[6, 6, 0, 0]}
                  barSize={40}
                  name="Detections"
                >
                  {chartData.map((entry) => (
                    <Cell key={`bar-${entry.name}`} fill={`url(#grad-${entry.name})`} />
                  ))}
                </Bar>

                {/* Confidence line */}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avgConfidence"
                  stroke="url(#confidenceGradient)"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#374151", stroke: "#fff", strokeWidth: 1 }}
                  activeDot={{ r: 6, stroke: "#111", strokeWidth: 1 }}
                  name="Avg Confidence"
                />
              </ComposedChart>
            ) : (
              // Validation Bar Chart
              <BarChart
                data={chartData.map((item) => ({
                  ...item,
                  name: item.name.charAt(0).toUpperCase() + item.name.slice(1),
                }))}
                margin={{ top: 10, right: 40, left: 40, bottom: 60 }}
              >
                <CartesianGrid stroke="#f0f0f0" strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#444", fontWeight: 500, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                />
                <YAxis
                  tick={{ fill: "#555", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.05)" }}
                  contentStyle={{
                    backgroundColor: "#fff",
                    borderRadius: "10px",
                    border: "1px solid #eee",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                  {chartData.map((entry) => (
                    <Cell
                      key={`bar-${entry.name}`}
                      fill={STATUS_COLORS[entry.name] || "#a3a3a3"}
                    />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      </div>
    </div>
  );
};

export default DashboardPage;