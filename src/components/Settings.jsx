import React, { useState, useEffect } from "react";
import { OFFSET_RANGES } from "../utils/constants";
import { useAuth } from "../AuthContext";
import { api } from "../utils/api";

export function Settings({ settings, offsets, onSave, onClose }) {
  const { logout } = useAuth();
  const [form, setForm] = useState(settings);
  const [offsetForm, setOffsetForm] = useState(offsets);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => setForm(settings), [settings]);
  useEffect(() => setOffsetForm(offsets), [offsets]);

  const saveAll = async () => {
    const result = await onSave(form, offsetForm);
    setStatus(result.success ? "Saved" : result.error || "Save failed");
  };

  const changePassword = async () => {
    const result = await api.changePassword(currentPassword, newPassword);
    setStatus(result.success ? "Password changed" : result.error || "Failed");
    if (result.success) { setCurrentPassword(""); setNewPassword(""); logout(); }
  };

  const clearHistory = async () => {
    if (!window.confirm("This will permanently delete all historical data. Continue?")) return;
    const result = await api.clearHistory();
    setStatus(result.success ? "History cleared" : result.error || "Failed");
  };

  return (
    <div className="settings-overlay">
      <div className="settings-panel">
        <div className="settings-header">
          <h2>Settings</h2>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>

        <section>
          <h3>System Settings</h3>
          <label>
            ESP32 Polling Interval (seconds)
            <input
              type="number"
              min="1"
              value={form.polling_interval || "5"}
              onChange={(e) => setForm({ ...form, polling_interval: e.target.value })}
            />
          </label>
        </section>

        <section>
          <h3>Sensor Calibration Offsets</h3>
          {Object.keys(OFFSET_RANGES).map((key) => (
            <label key={key}>
              {key} (±{OFFSET_RANGES[key]})
              <input
                type="number"
                step="0.01"
                value={offsetForm[key] ?? 0}
                onChange={(e) => setOffsetForm({ ...offsetForm, [key]: parseFloat(e.target.value) || 0 })}
              />
            </label>
          ))}
        </section>

        <button className="save-btn" onClick={saveAll}>Save Settings</button>

        <section>
          <h3>Account &amp; Data</h3>
          <label>Current Password<input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></label>
          <label>New Password<input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>
          <button onClick={changePassword}>Change Password</button>
          <button className="danger-btn" onClick={clearHistory}>Clear History Data</button>
          <a href={api.exportCsvUrl()} download className="export-btn">Export Data as CSV</a>
        </section>

        {status && <div className="settings-status">{status}</div>}
      </div>
    </div>
  );
}

export default Settings;
