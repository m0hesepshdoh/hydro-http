import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../utils/api";
import { POLLING_INTERVAL_MS } from "../utils/constants";

/**
 * Polls the Worker for latest sensor data + relay states + ESP32 heartbeat.
 * Replaces MQTT/WebSocket real-time updates in the HTTP-only architecture.
 */
export function usePolling(intervalMs = POLLING_INTERVAL_MS) {
  const [sensorData, setSensorData] = useState(null);
  const [relayState, setRelayState] = useState({ 1: "OFF", 2: "OFF", 3: "OFF", 4: "OFF" });
  const [esp32Status, setEsp32Status] = useState({ last_seen: "", ip_address: "" });
  const [connStatus, setConnStatus] = useState("connecting"); // connecting | online | offline | error
  const [lastReceived, setLastReceived] = useState(null);
  const timerRef = useRef(null);

  const poll = useCallback(async () => {
    try {
      const [latest, relays, esp32] = await Promise.all([
        api.getLatest(),
        api.getRelayStatus(),
        api.getEsp32Status(),
      ]);

      if (latest && latest.timestamp) {
        setSensorData(latest);
        setLastReceived(new Date());
      }

      if (Array.isArray(relays)) {
        const map = {};
        for (const r of relays) map[r.relay_number] = r.state;
        setRelayState((prev) => ({ ...prev, ...map }));
      }

      setEsp32Status(esp32 || {});

      // Consider ESP32 "online" if last_seen was within 3x the polling interval
      const lastSeenTime = esp32?.last_seen ? new Date(esp32.last_seen).getTime() : 0;
      const staleAfter = intervalMs * 3 + 5000;
      setConnStatus(Date.now() - lastSeenTime < staleAfter ? "online" : "offline");
    } catch (err) {
      console.error("Polling error:", err);
      setConnStatus("error");
    }
  }, [intervalMs]);

  useEffect(() => {
    poll();
    timerRef.current = setInterval(poll, intervalMs);
    return () => clearInterval(timerRef.current);
  }, [poll, intervalMs]);

  return { sensorData, relayState, esp32Status, connStatus, lastReceived, refetch: poll };
}
