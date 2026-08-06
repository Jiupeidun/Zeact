import { useCallback, useMemo, useState } from 'react';
import type { ChartMode } from './use-realtime-line-chart';

export interface ChartControlsOptions {
  initialWindowSeconds?: number;
  initialMode?: ChartMode;
  initiallyHiddenLayers?: Iterable<string>;
}

/** State-only chart controls for teams that render their own toolbar. */
export function useChartControls(options: ChartControlsOptions = {}) {
  const {
    initialWindowSeconds = 30,
    initialMode = 'line',
    initiallyHiddenLayers = [],
  } = options;
  const [windowSeconds, setWindowSeconds] = useState(initialWindowSeconds);
  const [mode, setMode] = useState<ChartMode>(initialMode);
  const [hiddenLayers, setHiddenLayers] = useState(() => new Set(initiallyHiddenLayers));

  const setLayerVisible = useCallback((id: string, visible: boolean) => {
    setHiddenLayers((current) => {
      const next = new Set(current);
      if (visible) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleLayer = useCallback((id: string) => {
    setHiddenLayers((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  return useMemo(() => ({
    windowSeconds,
    setWindowSeconds,
    mode,
    setMode,
    hiddenLayers,
    isLayerVisible: (id: string) => !hiddenLayers.has(id),
    setLayerVisible,
    toggleLayer,
  }), [hiddenLayers, mode, setLayerVisible, toggleLayer, windowSeconds]);
}
