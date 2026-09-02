-- =====================================================
-- Hydroponic Dashboard (HTTP polling architecture) — Cloudflare D1 Schema
-- Run with: wrangler d1 execute hydro-db --file=./schema.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS sensor_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    air_temp REAL,
    air_humidity REAL,
    water_temp REAL,
    soil_moisture REAL,
    tds REAL,
    flow_rate REAL,
    relay1 INTEGER DEFAULT 0,
    relay2 INTEGER DEFAULT 0,
    relay3 INTEGER DEFAULT 0,
    relay4 INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sensor_readings_timestamp ON sensor_readings(timestamp);

CREATE TABLE IF NOT EXISTS relay_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    relay_number INTEGER,
    action TEXT CHECK(action IN ('ON', 'OFF')),
    source TEXT CHECK(source IN ('manual', 'auto', 'esp32'))
);

CREATE INDEX IF NOT EXISTS idx_relay_logs_timestamp ON relay_logs(timestamp);

CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sensor_offsets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sensor_name TEXT UNIQUE NOT NULL,
    offset REAL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ESP32 configuration / heartbeat
CREATE TABLE IF NOT EXISTS esp32_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Relay states (what the ESP32 will be told on its next poll)
CREATE TABLE IF NOT EXISTS relay_states (
    relay_number INTEGER PRIMARY KEY,
    state TEXT CHECK(state IN ('ON','OFF')) DEFAULT 'OFF',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Initial data.
-- NOTE: admin_password_hash is populated via POST /api/auth/bootstrap on first deploy
-- (SHA-256 hash of "admin123" by default) — see DEPLOYMENT.md. Never stored as plaintext.
INSERT OR IGNORE INTO settings (key, value) VALUES
    ('admin_password_hash', '34cd36f201780049f43bba43c350fa7d422a40b121e033502abec429e70a5480'),
    ('polling_interval', '5');

INSERT OR IGNORE INTO sensor_offsets (sensor_name, offset) VALUES
    ('air_temp', 0),
    ('air_humidity', 0),
    ('water_temp', 0),
    ('soil_moisture', 0),
    ('tds', 0),
    ('flow_rate', 0);

INSERT OR IGNORE INTO esp32_config (key, value) VALUES
    ('last_seen', ''),
    ('ip_address', '');

INSERT OR IGNORE INTO relay_states (relay_number, state) VALUES
    (1, 'OFF'), (2, 'OFF'), (3, 'OFF'), (4, 'OFF');
