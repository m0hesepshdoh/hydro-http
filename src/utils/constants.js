export const SENSOR_META = {
  air_temp: { label: "Air Temperature", unit: "°C", icon: "🌡️", warnLow: 15, warnHigh: 32, critLow: 10, critHigh: 38 },
  air_humidity: { label: "Air Humidity", unit: "%", icon: "💧", warnLow: 40, warnHigh: 80, critLow: 20, critHigh: 90 },
  water_temp: { label: "Water Temperature", unit: "°C", icon: "🌊", warnLow: 18, warnHigh: 28, critLow: 12, critHigh: 32 },
  soil_moisture: { label: "Soil Moisture", unit: "%", icon: "🌱", warnLow: 30, warnHigh: 80, critLow: 15, critHigh: 95 },
  tds: { label: "EC", unit: "ppm", icon: "⚡", warnLow: 500, warnHigh: 1500, critLow: 200, critHigh: 2000 },
  flow_rate: { label: "Water Flow", unit: "L/min", icon: "💦", warnLow: 0.2, warnHigh: 10, critLow: 0, critHigh: 15 },
};

export const OFFSET_RANGES = {
  air_temp: 5,
  air_humidity: 10,
  water_temp: 5,
  soil_moisture: 10,
  tds: 100,
  flow_rate: 0.5,
};

export const DEFAULT_SETTINGS = {
  polling_interval: "5",
};

export const WORKER_URL = import.meta.env.VITE_WORKER_URL;
export const POLLING_INTERVAL_MS = Number(import.meta.env.VITE_POLLING_INTERVAL || 5000);
