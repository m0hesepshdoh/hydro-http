# Deployment Guide — Hydroponic Farm Dashboard (HTTP Architecture)

Stack: React 18 (Vite) on **Cloudflare Pages** · **Cloudflare Worker** (handles ESP32 telemetry + all DB ops) · **Cloudflare D1** · plain **HTTP polling** — no MQTT, no NETPIE.

## 1. Project Setup

```bash
cd hydro-http
npm install
```

Layout:
```
src/App.jsx, AuthContext.jsx, main.jsx
src/components/{LandingPage,Dashboard,SensorCard,RelayButton,Charts,Settings,StatusBar,Footer}.jsx
src/hooks/{usePolling,useSensors,useSettings}.js
src/utils/{api,constants}.js
src/styles/globals.css
worker/{worker.js,wrangler.toml}
schema.sql
```

## 2. Create the D1 Database

```bash
cd worker
npx wrangler login
npx wrangler d1 create hydro-db
```

Paste the returned `database_id` into `worker/wrangler.toml`, then load the schema:

```bash
npx wrangler d1 execute hydro-db --remote --file=../schema.sql
```

## 3. Deploy the Worker

```bash
npx wrangler deploy
```

Bootstrap the admin password once:

```bash
curl -X POST https://hydro-worker.ug671431015.workers.dev/api/auth/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"password":"fst12345"}'
```

## 4. Point the ESP32 at the Worker

No code logic changes needed — only update the endpoint URL in the existing ESP32 sketch:

```cpp
const char* worker_url = "https://hydro-worker.ug671431015.workers.dev/api/telemetry";
```

The ESP32 already POSTs `{ airTemp, humidity, waterTemp, soilMoisture, tds, flowRate }` and reads back
`{ r1, r2, r3, r4, success }` from the response to drive its relays — this matches the Worker's
`/api/telemetry` contract exactly.

## 5. Configure Environment Variables (React / Vite)

Copy `.env.example` to `.env.production`:

```
VITE_WORKER_URL=https://hydro-worker.ug671431015.workers.dev
VITE_POLLING_INTERVAL=5000
```

## 6. Build and Deploy to Cloudflare Pages

```bash
npm run build
npx wrangler pages deploy dist --project-name=hydro-dashboard
```

Or connect the git repo in the Cloudflare Pages dashboard for automatic deploys, setting
`VITE_WORKER_URL` and `VITE_POLLING_INTERVAL` under **Pages → Settings → Environment variables**.

## 7. First-Run Configuration

1. Open the deployed Pages URL and log in with the bootstrap password.
2. Open Settings (gear icon) and set the ESP32 polling interval to match your firmware's send rate.
3. Change the admin password from the default immediately.
4. Power on the ESP32 — its first successful POST to `/api/telemetry` populates `esp32_config.last_seen`
   and the dashboard's "ESP32 last seen" status pill.

## Testing Checklist

- [ ] Landing page loads; correct password grants access, incorrect password shows an error
- [ ] All 6 sensor cards (air temp, air humidity, water temp, soil moisture, TDS, flow) render
- [ ] Sensor values refresh every polling interval (default 5s) without a page reload
- [ ] Calibration offsets from Settings are reflected in displayed values
- [ ] Relay buttons show correct ON/OFF state and toggle correctly
- [ ] Toggling a relay writes a row to `relay_logs` and the ESP32 receives the new state
      on its next `/api/telemetry` POST
- [ ] Charts render for 24h / 7d / 30d / All ranges with correct min/max/avg stats
- [ ] Settings panel requires the current password to change the password
- [ ] Polling interval setting updates React's poll frequency after save
- [ ] Export CSV downloads the full `sensor_readings` table
- [ ] Clear History prompts confirmation, then empties `sensor_readings` and `relay_logs`
- [ ] Status bar shows API connectivity, last data time, and ESP32 last-seen timestamp
- [ ] "ESP32 last seen" flips to a stale/offline indicator if no telemetry arrives for
      3x the polling interval
- [ ] Mobile responsive from 320px to desktop widths
- [ ] CORS allows the Pages origin (or `*` during testing) to call the Worker
- [ ] D1 persists all readings indefinitely (no automatic pruning)

## Notes on This Architecture vs. the MQTT Version

- There is **no WebSocket or MQTT broker** anywhere in this build — every data path is a plain
  HTTP request, matching the existing ESP32 firmware exactly (no firmware changes required).
- Relay commands are **not pushed instantly** to the ESP32. React calls `/api/relays/control`,
  the Worker stores the new desired state, and the ESP32 picks it up on its next scheduled
  `/api/telemetry` POST. Expect a control-to-effect delay of up to one polling interval.
- The original spec's chart section mentioned "pH," but the D1 schema and ESP32 payload in
  `HydroponicFarm.md` have no pH sensor (it uses `water_temp` from a DS18B20 instead) — the
  Charts component here plots Air Temperature and Water Temperature.
- Passwords are hashed with SHA-256 via the Worker's native Web Crypto API and never stored
  in plaintext; the session "token" is the raw password re-hashed per request, held only in
  `sessionStorage`.
