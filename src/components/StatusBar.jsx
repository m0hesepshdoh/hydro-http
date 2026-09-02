import React from "react";

export function StatusBar({ connStatus, lastReceived, esp32Status }) {
  const esp32LastSeen = esp32Status?.last_seen
    ? new Date(esp32Status.last_seen).toLocaleTimeString()
    : "Never";

  return (
    <div className="status-bar">
      <div className={`status-pill conn-${connStatus}`}>
        API: {connStatus}
      </div>
      <div className="status-pill">
        Last data: {lastReceived ? lastReceived.toLocaleTimeString() : "—"}
      </div>
      <div className="status-pill">
        ESP32 last seen: {esp32LastSeen}
      </div>
      <div className="status-pill">
        DB: ok
      </div>
    </div>
  );
}

export default StatusBar;
