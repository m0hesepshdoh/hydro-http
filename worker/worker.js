/**
 * Cloudflare Worker — Hydroponic Dashboard API (HTTP-only architecture)
 *
 * ESP32 <-> Worker: plain HTTP POST/response (no MQTT, no NETPIE).
 * React <-> Worker: HTTP polling (GET /api/sensors/latest, /api/relays/status every N seconds).
 *
 * Bindings required (wrangler.toml):
 *   [[d1_databases]]
 *   binding = "DB"
 *   database_name = "hydro-db"
 *   database_id = "<your-d1-id>"
 *
 * Optional env var:
 *   CORS_ORIGIN  (defaults to "*")
 */

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.CORS_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  };
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

async function sha256(text) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function requireAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) return false;
  const row = await env.DB.prepare(
    "SELECT value FROM settings WHERE key = 'admin_password_hash'",
  ).first();
  const expectedHash = row?.value || "";
  const tokenHash = await sha256(token);
  return expectedHash && tokenHash === expectedHash;
}

async function getOffsets(env) {
  const { results } = await env.DB.prepare(
    "SELECT sensor_name, offset FROM sensor_offsets",
  ).all();
  const map = {};
  for (const r of results) map[r.sensor_name] = r.offset;
  return map;
}

const OFFSET_KEYS = [
  "air_temp",
  "air_humidity",
  "water_temp",
  "soil_moisture",
  "tds",
  "flow_rate",
];

function applyOffsets(row, offsets) {
  if (!row) return row;
  const out = { ...row };
  for (const key of OFFSET_KEYS) {
    if (out[key] != null)
      out[key] = +(out[key] + (offsets[key] || 0)).toFixed(2);
  }
  return out;
}

async function getRelayStates(env) {
  const { results } = await env.DB.prepare(
    "SELECT relay_number, state FROM relay_states ORDER BY relay_number",
  ).all();
  const map = { r1: 1, r2: 1, r3: 1, r4: 1 };
  for (const r of results) map[`r${r.relay_number}`] = r.state === "ON" ? 0 : 1;
  return map;
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(env);
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === "OPTIONS") return new Response(null, { headers: cors });

    try {
      // ================= AUTH =================
      if (path === "/api/auth/bootstrap" && method === "POST") {
        const existing = await env.DB.prepare(
          "SELECT value FROM settings WHERE key='admin_password_hash'",
        ).first();
        if (existing?.value)
          return json({ error: "Already initialized" }, 400, cors);
        const { password } = await request.json();
        const hash = await sha256(password || "admin123");
        await env.DB.prepare(
          "UPDATE settings SET value=?, updated_at=CURRENT_TIMESTAMP WHERE key='admin_password_hash'",
        )
          .bind(hash)
          .run();
        return json({ success: true }, 200, cors);
      }

      if (path === "/api/auth" && method === "POST") {
        const { password } = await request.json();
        const row = await env.DB.prepare(
          "SELECT value FROM settings WHERE key='admin_password_hash'",
        ).first();
        const hash = await sha256(password || "");
        if (row?.value && row.value === hash) {
          return json({ success: true, token: password }, 200, cors);
        }
        return json({ success: false, error: "Invalid password" }, 401, cors);
      }

      if (path === "/api/auth/change" && method === "POST") {
        if (!(await requireAuth(request, env)))
          return json({ error: "Unauthorized" }, 401, cors);
        const { currentPassword, newPassword } = await request.json();
        const row = await env.DB.prepare(
          "SELECT value FROM settings WHERE key='admin_password_hash'",
        ).first();
        const curHash = await sha256(currentPassword || "");
        if (row?.value !== curHash)
          return json({ error: "Current password incorrect" }, 401, cors);
        const newHash = await sha256(newPassword);
        await env.DB.prepare(
          "UPDATE settings SET value=?, updated_at=CURRENT_TIMESTAMP WHERE key='admin_password_hash'",
        )
          .bind(newHash)
          .run();
        return json({ success: true }, 200, cors);
      }

      // ================= ESP32 TELEMETRY =================
      // ESP32 -> Worker: sends sensor data, receives relay states in response
      if (path === "/api/telemetry" && method === "POST") {
        const d = await request.json();
        const relays = await getRelayStates(env);

        await env.DB.prepare(
          `INSERT INTO sensor_readings
           (air_temp, air_humidity, water_temp, soil_moisture, tds, flow_rate, relay1, relay2, relay3, relay4)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
        )
          .bind(
            d.airTemp ?? null,
            d.humidity ?? null,
            d.waterTemp ?? null,
            d.soilMoisture ?? null,
            d.tds ?? null,
            d.flowRate ?? null,
            relays.r1,
            relays.r2,
            relays.r3,
            relays.r4,
          )
          .run();

        const clientIp = request.headers.get("CF-Connecting-IP") || "";
        await env.DB.prepare(
          "INSERT INTO esp32_config (key, value) VALUES ('last_seen', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP",
        )
          .bind(new Date().toISOString())
          .run();
        await env.DB.prepare(
          "INSERT INTO esp32_config (key, value) VALUES ('ip_address', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP",
        )
          .bind(clientIp)
          .run();

        return json({ ...relays, success: true }, 200, cors);
      }

      // ================= RELAY CONTROL (React -> Worker) =================
      if (path === "/api/relays/control" && method === "POST") {
        const { relay, action } = await request.json();
        if (
          ![1, 2, 3, 4].includes(Number(relay)) ||
          !["ON", "OFF"].includes(action)
        ) {
          return json({ error: "Invalid relay or action" }, 400, cors);
        }
        await env.DB.prepare(
          "INSERT INTO relay_states (relay_number, state, updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(relay_number) DO UPDATE SET state=excluded.state, updated_at=CURRENT_TIMESTAMP",
        )
          .bind(relay, action)
          .run();
        await env.DB.prepare(
          "INSERT INTO relay_logs (relay_number, action, source) VALUES (?,?,?)",
        )
          .bind(relay, action, "manual")
          .run();
        return json({ success: true }, 200, cors);
      }

      if (path === "/api/relays/status" && method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT * FROM relay_states ORDER BY relay_number",
        ).all();
        return json(results, 200, cors);
      }

      // ================= SENSORS (React polling) =================
      if (path === "/api/sensors/latest" && method === "GET") {
        const row = await env.DB.prepare(
          "SELECT * FROM sensor_readings ORDER BY id DESC LIMIT 1",
        ).first();
        const offsets = await getOffsets(env);
        return json(applyOffsets(row, offsets), 200, cors);
      }

      if (path === "/api/sensors/history" && method === "GET") {
        const hours = url.searchParams.get("hours");
        const days = url.searchParams.get("days");
        const limit = Math.min(
          parseInt(url.searchParams.get("limit") || "100", 10),
          1000,
        );

        let sinceClause = "";
        if (hours) {
          sinceClause = `WHERE timestamp >= datetime('now', '-${parseInt(hours, 10)} hours')`;
        } else if (days) {
          sinceClause = `WHERE timestamp >= datetime('now', '-${parseInt(days, 10)} days')`;
        } else {
          sinceClause = `WHERE timestamp >= datetime('now', '-1 hours')`;
        }

        const { results } = await env.DB.prepare(
          `SELECT * FROM sensor_readings ${sinceClause} ORDER BY timestamp ASC LIMIT ?`,
        )
          .bind(limit)
          .all();
        const offsets = await getOffsets(env);
        const rows = results.map((r) => applyOffsets(r, offsets));
        const agg = (key) => {
          const vals = rows.map((r) => r[key]).filter((v) => v != null);
          if (!vals.length) return { min: null, max: null, avg: null };
          const min = Math.min(...vals),
            max = Math.max(...vals);
          const avg = +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(
            2,
          );
          return { min, max, avg };
        };
        return json(
          {
            data: rows,
            stats: { air_temp: agg("air_temp"), water_temp: agg("water_temp") },
          },
          200,
          cors,
        );
      }

      // ================= SETTINGS =================
      if (path === "/api/settings" && method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT key, value FROM settings",
        ).all();
        const offsets = await getOffsets(env);
        const settingsMap = {};
        for (const r of results) {
          if (r.key === "admin_password_hash") continue;
          settingsMap[r.key] = r.value;
        }
        return json({ settings: settingsMap, offsets }, 200, cors);
      }

      if (path === "/api/settings" && method === "POST") {
        if (!(await requireAuth(request, env)))
          return json({ error: "Unauthorized" }, 401, cors);
        const { settings = {}, offsets = {} } = await request.json();
        for (const [k, v] of Object.entries(settings)) {
          if (k === "admin_password_hash") continue;
          await env.DB.prepare(
            "INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP",
          )
            .bind(k, String(v))
            .run();
        }
        for (const [k, v] of Object.entries(offsets)) {
          await env.DB.prepare(
            "INSERT INTO sensor_offsets (sensor_name, offset) VALUES (?,?) ON CONFLICT(sensor_name) DO UPDATE SET offset=excluded.offset, updated_at=CURRENT_TIMESTAMP",
          )
            .bind(k, Number(v))
            .run();
        }
        return json({ success: true }, 200, cors);
      }

      // ================= ESP32 STATUS =================
      if (path === "/api/esp32/status" && method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT key, value FROM esp32_config",
        ).all();
        const map = {};
        for (const r of results) map[r.key] = r.value;
        return json(map, 200, cors);
      }

      // ================= EXPORT / HISTORY =================
      if (path === "/api/export" && method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT * FROM sensor_readings ORDER BY timestamp ASC",
        ).all();
        const headers = [
          "id",
          "timestamp",
          "air_temp",
          "air_humidity",
          "water_temp",
          "soil_moisture",
          "tds",
          "flow_rate",
          "relay1",
          "relay2",
          "relay3",
          "relay4",
        ];
        const csv = [headers.join(",")]
          .concat(results.map((r) => headers.map((h) => r[h] ?? "").join(",")))
          .join("\n");
        return new Response(csv, {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": "attachment; filename=sensor_history.csv",
            ...cors,
          },
        });
      }

      if (path === "/api/history" && method === "DELETE") {
        if (!(await requireAuth(request, env)))
          return json({ error: "Unauthorized" }, 401, cors);
        await env.DB.prepare("DELETE FROM sensor_readings").run();
        await env.DB.prepare("DELETE FROM relay_logs").run();
        return json({ success: true }, 200, cors);
      }

      return json({ error: "Not found" }, 404, cors);
    } catch (err) {
      return json({ error: err.message }, 500, cors);
    }
  },
};
