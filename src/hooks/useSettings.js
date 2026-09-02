import { useState, useEffect, useCallback } from "react";
import { api } from "../utils/api";
import { DEFAULT_SETTINGS } from "../utils/constants";

export function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [offsets, setOffsets] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getSettings();
      setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      setOffsets(data.offsets || {});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (newSettings, newOffsets) => {
    const result = await api.saveSettings(newSettings, newOffsets);
    if (result.success) {
      setSettings((prev) => ({ ...prev, ...newSettings }));
      setOffsets((prev) => ({ ...prev, ...newOffsets }));
    }
    return result;
  }, []);

  return { settings, offsets, loading, save, reload: load };
}
