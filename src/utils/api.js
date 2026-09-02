import { WORKER_URL } from "./constants";

function authHeaders() {
  const token = sessionStorage.getItem("hydro_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  async login(password) {
    const res = await fetch(`${WORKER_URL}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (data.success) sessionStorage.setItem("hydro_token", data.token);
    return data;
  },

  async changePassword(currentPassword, newPassword) {
    const res = await fetch(`${WORKER_URL}/api/auth/change`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return res.json();
  },

  async getLatest() {
    const res = await fetch(`${WORKER_URL}/api/sensors/latest`);
    return res.json();
  },

  async getHistory({ hours, days, limit } = {}) {
    const params = new URLSearchParams();
    if (hours) params.set("hours", hours);
    if (days) params.set("days", days);
    if (limit) params.set("limit", limit);
    const res = await fetch(`${WORKER_URL}/api/sensors/history?${params.toString()}`);
    return res.json();
  },

  async getRelayStatus() {
    const res = await fetch(`${WORKER_URL}/api/relays/status`);
    return res.json();
  },

  async controlRelay(relay, action) {
    const res = await fetch(`${WORKER_URL}/api/relays/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relay, action }),
    });
    return res.json();
  },

  async getSettings() {
    const res = await fetch(`${WORKER_URL}/api/settings`);
    return res.json();
  },

  async saveSettings(settings, offsets) {
    const res = await fetch(`${WORKER_URL}/api/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ settings, offsets }),
    });
    return res.json();
  },

  async getEsp32Status() {
    const res = await fetch(`${WORKER_URL}/api/esp32/status`);
    return res.json();
  },

  async clearHistory() {
    const res = await fetch(`${WORKER_URL}/api/history`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    return res.json();
  },

  exportCsvUrl() {
    return `${WORKER_URL}/api/export`;
  },
};
