import React, { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { api } from "../utils/api";

const RANGES = [
  { label: "1h", hours: 1, limit: 360 },
  { label: "24h", hours: 24, limit: 1000 },
  { label: "7d", days: 7, limit: 1000 },
  { label: "30d", days: 30, limit: 1000 },
];

// This chart shows Air Temperature and Water Temperature instead.
export function Charts() {
  const [range, setRange] = useState(RANGES[0]);
  const [data, setData] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.getHistory(range).then((res) => {
      if (!active) return;
      setData(
        (res.data || []).map((d) => ({
          ...d,
          time: new Date(d.timestamp).toLocaleString(),
        }))
      );
      setStats(res.stats || {});
      setLoading(false);
    });
    return () => { active = false; };
  }, [range]);

  return (
    <div className="charts-section">
      <div className="charts-header">
        <h2>Historical Data</h2>
        <div className="range-selector">
          {RANGES.map((r) => (
            <button
              key={r.label}
              className={r.label === range.label ? "range-btn active" : "range-btn"}
              onClick={() => setRange(r)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-stats">
        {stats.air_temp && (
          <span>Air Temp — min {stats.air_temp.min}°C / max {stats.air_temp.max}°C / avg {stats.air_temp.avg}°C</span>
        )}
        {stats.water_temp && (
          <span>Water Temp — min {stats.water_temp.min}°C / max {stats.water_temp.max}°C / avg {stats.water_temp.avg}°C</span>
        )}
      </div>

      {loading ? (
        <div className="chart-loading">Loading chart data...</div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#aaaaaa" }} minTickGap={40} />
            <YAxis tick={{ fontSize: 10, fill: "#aaaaaa" }} />
            <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #4fc3f7" }} />
            <Legend />
            <Line type="monotone" dataKey="air_temp" stroke="#f44336" name="Air Temp (°C)" dot={false} />
            <Line type="monotone" dataKey="water_temp" stroke="#4fc3f7" name="Water Temp (°C)" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default Charts;
