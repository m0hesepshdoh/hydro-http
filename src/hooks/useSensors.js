import { useCallback, useState } from "react";
import { api } from "../utils/api";

/**
 * Wraps relay control actions. Actual state comes from polling (usePolling);
 * this hook just issues the control command and logs it via the Worker.
 */
export function useSensors(relayState, setOptimisticRelay) {
  const [pending, setPending] = useState({});

  const toggleRelay = useCallback(
    async (relayNumber) => {
      const current = relayState[relayNumber];
      const next = current === "ON" ? "OFF" : "ON";
      setPending((p) => ({ ...p, [relayNumber]: true }));
      try {
        const result = await api.controlRelay(relayNumber, next);
        if (result.success && setOptimisticRelay) {
          setOptimisticRelay(relayNumber, next);
        }
        return result;
      } finally {
        setPending((p) => ({ ...p, [relayNumber]: false }));
      }
    },
    [relayState, setOptimisticRelay]
  );

  return { toggleRelay, pending };
}
