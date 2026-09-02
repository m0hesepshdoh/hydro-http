import React from "react";

export function Footer({ onOpenSettings }) {
  return (
    <footer className="app-footer">
      <span>Hydroponic Dashboard</span>
      <button className="gear-btn" onClick={onOpenSettings} aria-label="Settings">⚙️</button>
    </footer>
  );
}

export default Footer;
