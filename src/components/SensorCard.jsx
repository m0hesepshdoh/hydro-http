import React from "react";
import { SENSOR_META } from "../utils/constants";

export function SensorCard({ sensorKey, value, lastUpdated }) {
  const meta = SENSOR_META[sensorKey];
  if (!meta) return null;

  let statusClass = "status-normal";
  let statusLabel = "Normal";
  if (value == null) {
    statusClass = "status-unknown";
    statusLabel = "No data";
  } else if (value <= meta.critLow || value >= meta.critHigh) {
    statusClass = "status-critical";
    statusLabel = "Critical";
  } else if (value <= meta.warnLow || value >= meta.warnHigh) {
    statusClass = "status-warning";
    statusLabel = "Warning";
  }

  return (
    <div className={`sensor-card ${statusClass}`}>
      <div className="sensor-card-header">
        <span className="sensor-icon">{meta.icon}</span>
        <span className="sensor-label">{meta.label}</span>
      </div>
      <div className="sensor-value">
        {value != null ? value.toFixed(2) : "--"}
        <span className="sensor-unit">{meta.unit}</span>
      </div>
      <div className="sensor-status-row">
        <span className={`status-dot ${statusClass}`} />
        <span className="status-text">{statusLabel}</span>
      </div>
      <div className="sensor-timestamp">
        {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "Never updated"}
      </div>
    </div>
  );
}

export default SensorCard;
