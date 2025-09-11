import React, { useEffect, useState } from "react";
import { PieChart, Pie, BarChart, Bar, XAxis,YAxis, CartesianGrid,Tooltip,Legend,Cell,} from "recharts";
import { Detection,DEFECT_CLASSES } from "../types";

interface DefectCount { name: string; value: number;}
interface PieLabel { name: string; percent: number;}

// COLORS array 
const COLORS = [
  "#b3f2ee", // teal
  "#fac184", // brown
  "#ed9da6", // pink
  "#95b9de", // blue
  "#c895de", // purple
  "#82ca9d", // sage green
  "#f7dd72", // yellow
];


const DashboardPage: React.FC = () => {
  const [defectCounts, setDefectCounts] = useState<DefectCount[]>([]);
  const [validationStatus, setValidationStatus] = useState<DefectCount[]>([]);
  const [selectedData, setSelectedData] = useState<"defect" | "status">("defect");
  const DEFECT_COLORS: Record<string, string> = DEFECT_CLASSES.reduce(
    (acc, cls, i) => {
        acc[cls] = COLORS[i % COLORS.length];
        return acc;
    },
    {} as Record<string, string>
    );

  useEffect(() => {
    fetch("http://localhost:8000/metadata")
      .then((res) => res.json())
      .then((data) => {
        const typeCount: Record<string, number> = {};
        const statusCount: Record<string, number> = {
          validated: 0,
          unvalidated: 0,
          healthy: 0,
        };

        data.forEach((item: any) => {
          item.detections.forEach((det: Detection) => {
            typeCount[det.defect_type] =
              (typeCount[det.defect_type] || 0) + 1;

            if (det.status === "validated") statusCount.validated++;
            else if (det.status === "healthy") statusCount.healthy++;
            else statusCount.unvalidated++;
          });
        });

        // Sort descending
        const sortedDefects = Object.entries(typeCount)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value);

        const sortedStatus = Object.entries(statusCount)
          .map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value,
          }))
          .sort((a, b) => b.value - a.value);

        setDefectCounts(sortedDefects);
        setValidationStatus(sortedStatus);
      });
  }, []);

  const chartData = selectedData === "defect" ? defectCounts : validationStatus;

  return (
    <div className="p-6 bg-gray-100 h-[60vh]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Dashboard Overview</h1>
        <select
          value={selectedData}
          onChange={(e) =>
            setSelectedData(e.target.value as "defect" | "status")
          }
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="defect">Defect Types</option>
          <option value="status">Validation Status</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-lg">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            {selectedData === "defect"
              ? "Defect Types Distribution"
              : "Validation Status Distribution"}
          </h2>
          <div className="flex justify-center">
            <PieChart width={600} height={380}>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius={140}
                dataKey="value"
                label={(props: PieLabel) =>
                  `${props.name} (${(props.percent * 100).toFixed(0)}%)`
                }
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${entry.name}`}
                    fill={DEFECT_COLORS[entry.name] || "#ccc"} // fallback gray
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-lg">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            {selectedData === "defect"
              ? "Defect Types (Sorted)"
              : "Validation Progress (Sorted)"}
          </h2>

          {selectedData === "status" ? (
            <BarChart
              width={600}
              height={380}
              data={chartData}
              margin={{ top: 20, right: 30, left: 30, bottom: 5 }}
            >
              <CartesianGrid stroke="#ccc" strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="value">
                {chartData.map((entry, index) => (
                  <Cell
                    key={`bar-${entry.name}`}
                    fill={DEFECT_COLORS[entry.name] || "#ccc"}
                  />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <BarChart
              layout="vertical"
              width={600}
              height={380}
              data={chartData}
              margin={{ top: 20, right: 30, left: 120, bottom: 5 }}
            >
              <CartesianGrid stroke="#ccc" strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis dataKey="name" type="category" />
              <Tooltip />
              <Legend />
              <Bar dataKey="value">
                {chartData.map((entry, index) => (
                  <Cell
                    key={`bar-${entry.name}`}
                    fill={DEFECT_COLORS[entry.name] || "#ccc"}
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
