import React, { useState, useCallback } from "react";
import { usePolling } from "../hooks/usePolling";
import { useSensors } from "../hooks/useSensors";
import { useSettings } from "../hooks/useSettings";
import { SensorCard } from "./SensorCard";
import { RelayButton } from "./RelayButton";
import { Charts } from "./Charts";
import { StatusBar } from "./StatusBar";
import { Settings } from "./Settings";
import { Footer } from "./Footer";
import { POLLING_INTERVAL_MS } from "../utils/constants";

const SENSOR_KEYS = ["air_temp", "air_humidity", "water_temp", "soil_moisture", "tds", "flow_rate"];

export function Dashboard() {
  const { settings, offsets, save } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const pollIntervalMs = settings.polling_interval
    ? Number(settings.polling_interval) * 1000
    : POLLING_INTERVAL_MS;

  const {
    sensorData, relayState, esp32Status, connStatus, lastReceived, refetch,
  } = usePolling(pollIntervalMs);

  const [optimisticRelay, setOptimisticRelay] = useState({});
  const mergedRelayState = { ...relayState, ...optimisticRelay };

  const setOptimistic = useCallback((relayNumber, state) => {
    setOptimisticRelay((prev) => ({ ...prev, [relayNumber]: state }));
  }, []);

  const { toggleRelay, pending } = useSensors(mergedRelayState, setOptimistic);

  const handleToggle = useCallback(
    async (relayNumber) => {
      await toggleRelay(relayNumber);
      refetch();
    },
    [toggleRelay, refetch]
  );

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>🌱 Hydroponic Farm Dashboard</h1>
      </header>

      <StatusBar connStatus={connStatus} lastReceived={lastReceived} esp32Status={esp32Status} />

      <div className="sensor-grid">
        {SENSOR_KEYS.map((key) => (
          <SensorCard
            key={key}
            sensorKey={key}
            value={sensorData ? sensorData[key] : null}
            lastUpdated={lastReceived}
          />
        ))}
      </div>

      <div className="relay-grid">
        {[1, 2, 3, 4].map((n) => (
          <RelayButton
            key={n}
            relayNumber={n}
            state={mergedRelayState[n]}
            onToggle={handleToggle}
            disabled={!!pending[n]}
          />
        ))}
      </div>

      <Charts />

      <Footer onOpenSettings={() => setSettingsOpen(true)} />

      {settingsOpen && (
        <Settings
          settings={settings}
          offsets={offsets}
          onSave={save}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

export default Dashboard;
