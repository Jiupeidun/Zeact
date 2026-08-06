import { useMemo, type CSSProperties } from 'react';
import type { RealtimeSeries } from './time-series';
import { useChartControls } from './use-chart-controls';
import {
  useRealtimeLineChart, type ChartMode, type RealtimeLineChartOptions,
} from './use-realtime-line-chart';

export interface ChartWindowOption {
  label: string;
  seconds: number;
}

export interface RealtimeLineChartProps extends RealtimeLineChartOptions {
  series: RealtimeSeries;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  windows?: readonly ChartWindowOption[];
  windowStyle?: 'default' | 'rounded' | 'text';
  onWindowChange?: (seconds: number) => void;
  allowModeToggle?: boolean;
  onModeChange?: (mode: ChartMode) => void;
  onSeriesToggle?: (id: string, visible: boolean) => void;
}

export function RealtimeLineChart(props: RealtimeLineChartProps) {
  const {
    series,
    className,
    style,
    ariaLabel = 'Real-time market chart',
    windows,
    windowStyle = 'default',
    onWindowChange,
    allowModeToggle = false,
    onModeChange,
    onSeriesToggle,
    ...options
  } = props;
  const controls = useChartControls({
    initialWindowSeconds: options.windowSeconds ?? windows?.[0]?.seconds ?? 30,
    initialMode: options.mode ?? 'line',
  });
  const effectiveWindow = options.windowSeconds ?? controls.windowSeconds;
  const effectiveMode = options.mode ?? controls.mode;
  const layers = useMemo(() => options.layers?.map((layer) => ({
    ...layer,
    visible: layer.visible !== false && controls.isLayerVisible(layer.id),
  })), [controls, options.layers]);
  const { canvasRef } = useRealtimeLineChart(series, {
    ...options,
    ...(layers ? { layers } : {}),
    mode: effectiveMode,
    windowSeconds: effectiveWindow,
  });

  const buttonStyle = (active: boolean): CSSProperties => ({
    background: active ? 'rgba(82,113,255,.9)' : 'rgba(15,23,42,.72)',
    border: windowStyle === 'text' ? 0 : '1px solid rgba(148,163,184,.24)',
    borderRadius: windowStyle === 'rounded' ? 999 : 6,
    color: active ? '#fff' : '#aab5c8',
    cursor: 'pointer',
    font: '600 11px system-ui, sans-serif',
    padding: windowStyle === 'text' ? '4px 5px' : '5px 8px',
  });

  return (
    <div className={className} style={{ height: '100%', position: 'relative', width: '100%', ...style }}>
      <canvas
        ref={canvasRef}
        aria-label={ariaLabel}
        role="img"
        style={{ display: 'block', height: '100%', touchAction: 'none', width: '100%' }}
      />
      {(windows?.length || allowModeToggle) && (
        <div style={{ display: 'flex', gap: 5, position: 'absolute', right: 8, top: 8 }}>
          {windows?.map((windowOption) => (
            <button
              key={windowOption.seconds}
              type="button"
              style={buttonStyle(effectiveWindow === windowOption.seconds)}
              onClick={() => {
                controls.setWindowSeconds(windowOption.seconds);
                onWindowChange?.(windowOption.seconds);
              }}
            >
              {windowOption.label}
            </button>
          ))}
          {allowModeToggle && (['line', 'candle'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              style={buttonStyle(effectiveMode === mode)}
              onClick={() => {
                controls.setMode(mode);
                onModeChange?.(mode);
              }}
            >
              {mode === 'line' ? 'Line' : 'Candles'}
            </button>
          ))}
        </div>
      )}
      {layers && layers.length > 1 && (
        <div style={{ bottom: 7, display: 'flex', gap: 5, left: 8, position: 'absolute' }}>
          {layers.map((layer) => (
            <button
              key={layer.id}
              type="button"
              style={{ ...buttonStyle(layer.visible !== false), borderColor: layer.color }}
              onClick={() => {
                const visible = !controls.isLayerVisible(layer.id);
                controls.toggleLayer(layer.id);
                onSeriesToggle?.(layer.id, visible);
              }}
            >
              <span style={{ color: layer.color }}>●</span> {layer.label ?? layer.id}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
