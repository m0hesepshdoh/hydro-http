import React from "react";

export function RelayButton({ relayNumber, state, onToggle, disabled }) {
  const isOn = state === "ON";
  return (
    <button
      className={`relay-button ${isOn ? "relay-on" : "relay-off"}`}
      onClick={() => onToggle(relayNumber)}
      disabled={disabled}
    >
      <span className="relay-label">Relay {relayNumber}</span>
      <span className="relay-state">{isOn ? "ON" : "OFF"}</span>
    </button>
  );
}

export default RelayButton;
