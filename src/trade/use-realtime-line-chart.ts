import { useCallback, useEffect, useRef, useState, type RefCallback } from 'react';
import { useLatest } from '../hooks/use-latest';
import type { RealtimeSeries, TimePoint } from './time-series';

export type ChartTheme = 'dark' | 'light';
export type ChartMomentum = 'up' | 'down' | 'flat';
export type ChartMode = 'line' | 'candle';

export interface ChartLayer {
  id: string;
  label?: string;
  color: string;
  series: RealtimeSeries;
  visible?: boolean;
}

export interface ReferenceLine {
  value: number;
  label?: string;
  color?: string;
}

export interface OrderbookData {
  bids: ReadonlyArray<readonly [price: number, size: number]>;
  asks: ReadonlyArray<readonly [price: number, size: number]>;
}

export interface DegenOptions {
  particles?: number;
  shake?: number;
  threshold?: number;
}

export interface ChartPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface RealtimeLineChartOptions {
  windowSeconds?: number;
  color?: string;
  theme?: ChartTheme;
  grid?: boolean;
  area?: boolean;
  badge?: boolean;
  crosshair?: boolean;
  paused?: boolean;
  response?: number;
  lineWidth?: number;
  curve?: 'linear' | 'soft';
  mode?: ChartMode;
  candleSeconds?: number;
  layers?: readonly ChartLayer[];
  momentum?: boolean | ChartMomentum;
  pulse?: boolean;
  showValue?: boolean;
  valueMomentumColor?: boolean;
  exaggerate?: boolean;
  loading?: boolean;
  emptyText?: string;
  badgeVariant?: 'accent' | 'minimal';
  badgeTail?: boolean;
  referenceLine?: ReferenceLine;
  orderbook?: OrderbookData;
  degen?: boolean | DegenOptions;
  formatValue?: (value: number) => string;
  formatTime?: (unixSeconds: number) => string;
  onHover?: (point: TimePoint | undefined) => void;
  padding?: Partial<ChartPadding>;
  cursor?: string;
  tooltipY?: number;
  tooltipOutline?: boolean;
}

export interface RealtimeLineChartBinding {
  canvasRef: RefCallback<HTMLCanvasElement>;
  canvas: HTMLCanvasElement | null;
}

interface Palette {
  background: string;
  grid: string;
  label: string;
  tooltip: string;
}

const DARK: Palette = {
  background: '#0a0f18', grid: 'rgba(148,163,184,.14)', label: '#8b98ad', tooltip: '#f8fafc',
};
const LIGHT: Palette = {
  background: '#ffffff', grid: 'rgba(71,85,105,.16)', label: '#64748b', tooltip: '#0f172a',
};

const defaultFormatValue = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 4 });
const defaultFormatTime = (time: number) => new Date(time * 1_000).toLocaleTimeString();

export interface CandlePoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface BurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export function aggregateCandles(series: RealtimeSeries, since: number, bucketSeconds: number): CandlePoint[] {
  const candles: CandlePoint[] = [];
  series.forEachSince(since, (time, value) => {
    const bucket = Math.floor(time / bucketSeconds) * bucketSeconds;
    const current = candles[candles.length - 1];
    if (!current || current.time !== bucket) {
      candles.push({ time: bucket, open: value, high: value, low: value, close: value });
    } else {
      current.high = Math.max(current.high, value);
      current.low = Math.min(current.low, value);
      current.close = value;
    }
  });
  return candles;
}

function resolveMomentum(forced: boolean | ChartMomentum | undefined, previous: number, next: number): ChartMomentum {
  if (typeof forced === 'string') return forced;
  if (forced === false || Math.abs(next - previous) < Number.EPSILON) return 'flat';
  return next > previous ? 'up' : 'down';
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

/**
 * Imperatively paints a moving market timeline. Ticks mutate the series and
 * invalidate the canvas; they never enter React state.
 */
export function useRealtimeLineChart(
  series: RealtimeSeries,
  options: RealtimeLineChartOptions = {},
): RealtimeLineChartBinding {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const optionsRef = useLatest(options);
  const frameRef = useRef<number>();
  const hoverRef = useRef<{ x: number; y: number }>();
  const frozenTimeRef = useRef<number>();
  const canvasRef = useCallback<RefCallback<HTMLCanvasElement>>((element) => setCanvas(element), []);

  useEffect(() => {
    if (!canvas) return undefined;
    const context = canvas.getContext('2d');
    if (!context) return undefined;

    let cssWidth = 0;
    let cssHeight = 0;
    let disposed = false;
    let previousFrame = performance.now();
    let displayedValue: number | undefined;
    let displayedMin: number | undefined;
    let displayedMax: number | undefined;
    let displayedMode = optionsRef.current.mode === 'candle' ? 1 : 0;
    let previousTickValue: number | undefined;
    let momentum: ChartMomentum = 'flat';
    let previousMomentum: ChartMomentum = 'flat';
    const particles: BurstParticle[] = [];
    let appliedCursor = '';

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      cssWidth = Math.max(1, bounds.width);
      cssHeight = Math.max(1, bounds.height);
      const width = Math.round(cssWidth * ratio);
      const height = Math.round(cssHeight * ratio);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
      }
    };

    const paint = (frameTime: number) => {
      frameRef.current = undefined;
      if (disposed || document.visibilityState === 'hidden') return;

      const config = optionsRef.current;
      const cursor = config.cursor ?? (config.crosshair === false ? 'default' : 'crosshair');
      if (cursor !== appliedCursor) {
        canvas.style.cursor = cursor;
        appliedCursor = cursor;
      }
      const palette = config.theme === 'light' ? LIGHT : DARK;
      const color = config.color ?? '#5271ff';
      const layers = config.layers?.filter((layer) => layer.visible !== false);
      const activeLayers: readonly ChartLayer[] = layers?.length
        ? layers
        : [{ id: 'primary', color, series }];
      const primarySeries = activeLayers[0]?.series ?? series;
      const windowSeconds = Math.max(1, config.windowSeconds ?? 30);
      const lineWidth = Math.max(0.5, config.lineWidth ?? 2);
      const response = Math.max(0.1, config.response ?? 12);
      const deltaSeconds = Math.min(0.1, Math.max(0, (frameTime - previousFrame) / 1_000));
      const blend = 1 - Math.exp(-response * deltaSeconds);
      previousFrame = frameTime;

      if (config.paused) frozenTimeRef.current ??= Date.now() / 1_000;
      else frozenTimeRef.current = undefined;
      const latest = primarySeries.last();
      const endTime = frozenTimeRef.current ?? Math.max(Date.now() / 1_000, latest?.time ?? 0);
      const startTime = endTime - windowSeconds;
      const padding: ChartPadding = {
        top: config.padding?.top ?? 16,
        right: config.padding?.right ?? (config.badge === false ? 16 : 86),
        bottom: config.padding?.bottom ?? 26,
        left: config.padding?.left ?? 12,
      };
      const plotWidth = Math.max(1, cssWidth - padding.left - padding.right);
      const plotHeight = Math.max(1, cssHeight - padding.top - padding.bottom);

      context.clearRect(0, 0, cssWidth, cssHeight);
      context.fillStyle = palette.background;
      context.fillRect(0, 0, cssWidth, cssHeight);

      if (!latest || primarySeries.length === 0) {
        context.fillStyle = palette.label;
        if (config.loading) {
          const breathe = 0.28 + 0.18 * Math.sin(frameTime / 480);
          context.globalAlpha = breathe;
          context.strokeStyle = color;
          context.lineWidth = 2;
          context.beginPath();
          for (let x = 0; x <= cssWidth; x += 4) {
            const y = cssHeight / 2 + Math.sin(x / 34 + frameTime / 700) * 8;
            if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
          }
          context.stroke();
          context.globalAlpha = 1;
          frameRef.current = requestAnimationFrame(paint);
        } else {
          context.font = '13px system-ui, sans-serif';
          context.textAlign = 'center';
          context.fillText(config.emptyText ?? 'No market data', cssWidth / 2, cssHeight / 2);
        }
        return;
      }

      displayedValue ??= latest.value;
      displayedValue += (latest.value - displayedValue) * blend;
      let rawMin = displayedValue;
      let rawMax = displayedValue;
      activeLayers.forEach((layer) => layer.series.forEachSince(startTime, (_time, value) => {
        rawMin = Math.min(rawMin, value);
        rawMax = Math.max(rawMax, value);
      }));
      if (config.mode === 'candle') {
        aggregateCandles(primarySeries, startTime, Math.max(1, config.candleSeconds ?? 10)).forEach((candle) => {
          rawMin = Math.min(rawMin, candle.low);
          rawMax = Math.max(rawMax, candle.high);
        });
      }
      if (config.referenceLine) {
        rawMin = Math.min(rawMin, config.referenceLine.value);
        rawMax = Math.max(rawMax, config.referenceLine.value);
      }
      config.orderbook?.bids.forEach(([price]) => {
        rawMin = Math.min(rawMin, price);
        rawMax = Math.max(rawMax, price);
      });
      config.orderbook?.asks.forEach(([price]) => {
        rawMin = Math.min(rawMin, price);
        rawMax = Math.max(rawMax, price);
      });
      const minimumRatio = config.exaggerate ? 0.0002 : 0.002;
      const rawRange = Math.max(Math.abs(rawMax) * minimumRatio, rawMax - rawMin, 1e-9);
      const rangePadding = config.exaggerate ? 0.04 : 0.12;
      const targetMin = rawMin - rawRange * rangePadding;
      const targetMax = rawMax + rawRange * rangePadding;
      displayedMin ??= targetMin;
      displayedMax ??= targetMax;
      displayedMin += (targetMin - displayedMin) * blend;
      displayedMax += (targetMax - displayedMax) * blend;
      const range = Math.max(1e-9, displayedMax - displayedMin);

      const xFor = (time: number) => padding.left + ((time - startTime) / windowSeconds) * plotWidth;
      const yFor = (value: number) => padding.top + ((displayedMax! - value) / range) * plotHeight;
      const degenConfig: DegenOptions | undefined = config.degen === true ? {} : config.degen || undefined;
      const shake = particles.length > 0 ? (degenConfig?.shake ?? 1.5) * Math.sin(frameTime / 18) : 0;
      context.save();
      context.translate(shake, -shake * 0.45);

      if (config.grid !== false) {
        context.strokeStyle = palette.grid;
        context.fillStyle = palette.label;
        context.font = '11px system-ui, sans-serif';
        context.textAlign = 'right';
        for (let row = 0; row <= 4; row += 1) {
          const y = padding.top + (plotHeight * row) / 4;
          context.beginPath();
          context.moveTo(padding.left, y);
          context.lineTo(padding.left + plotWidth, y);
          context.stroke();
          const value = displayedMax - (range * row) / 4;
          context.fillText((config.formatValue ?? defaultFormatValue)(value), cssWidth - 4, y + 4);
        }
      }

      const tipX = padding.left + plotWidth;
      const tipY = yFor(displayedValue);

      if (config.orderbook) {
        const entries = [
          ...config.orderbook.bids.map(([price, size]) => ({ price, size, side: 'bid' as const })),
          ...config.orderbook.asks.map(([price, size]) => ({ price, size, side: 'ask' as const })),
        ];
        const maxSize = Math.max(1, ...entries.map((entry) => entry.size));
        entries.forEach((entry) => {
          const y = yFor(entry.price);
          const strength = 0.05 + (entry.size / maxSize) * 0.16;
          context.fillStyle = entry.side === 'bid' ? '#34d399' : '#fb7185';
          context.globalAlpha = strength;
          context.fillRect(padding.left, y - 6, plotWidth * (entry.size / maxSize), 12);
          context.globalAlpha = Math.min(0.7, strength * 3);
          context.font = '10px system-ui, sans-serif';
          context.textAlign = 'left';
          context.fillText(`${entry.side === 'bid' ? 'B' : 'A'} ${entry.size}`, padding.left + 4, y + 3);
          context.globalAlpha = 1;
        });
      }

      if (config.referenceLine) {
        const y = yFor(config.referenceLine.value);
        context.save();
        context.strokeStyle = config.referenceLine.color ?? palette.label;
        context.setLineDash([6, 5]);
        context.beginPath();
        context.moveTo(padding.left, y);
        context.lineTo(padding.left + plotWidth, y);
        context.stroke();
        context.setLineDash([]);
        context.fillStyle = config.referenceLine.color ?? palette.label;
        context.font = '11px system-ui, sans-serif';
        context.textAlign = 'left';
        context.fillText(
          config.referenceLine.label ?? (config.formatValue ?? defaultFormatValue)(config.referenceLine.value),
          padding.left + 5,
          y - 5,
        );
        context.restore();
      }

      const targetMode = config.mode === 'candle' ? 1 : 0;
      displayedMode += (targetMode - displayedMode) * blend;

      const drawLayer = (layer: ChartLayer, layerIndex: number) => {
        const line = new Path2D();
        let count = 0;
        let firstX = 0;
        let lastX = 0;
        let lastY = 0;
        layer.series.forEachSince(startTime, (time, value) => {
          const x = xFor(time);
          const y = yFor(value);
          if (count === 0) {
            firstX = x;
            line.moveTo(x, y);
          } else if (config.curve !== 'linear') {
            line.quadraticCurveTo(lastX, lastY, (lastX + x) / 2, (lastY + y) / 2);
          } else {
            line.lineTo(x, y);
          }
          lastX = x;
          lastY = y;
          count += 1;
        });
        if (count > 1 && config.curve !== 'linear') line.lineTo(lastX, lastY);
        const layerLatest = layer.series.last();
        const layerTipY = yFor(layerIndex === 0 ? displayedValue! : (layerLatest?.value ?? displayedValue!));
        if (count === 0) {
          firstX = tipX;
          line.moveTo(tipX, layerTipY);
        } else if (tipX > lastX) {
          line.lineTo(tipX, layerTipY);
        }

        if (config.area !== false && activeLayers.length === 1) {
          const area = new Path2D(line);
          area.lineTo(tipX, padding.top + plotHeight);
          area.lineTo(firstX, padding.top + plotHeight);
          area.closePath();
          const gradient = context.createLinearGradient(0, padding.top, 0, padding.top + plotHeight);
          gradient.addColorStop(0, layer.color);
          gradient.addColorStop(1, 'transparent');
          context.save();
          context.globalAlpha = 0.22 * (1 - displayedMode);
          context.fillStyle = gradient;
          context.fill(area);
          context.restore();
        }

        context.save();
        context.globalAlpha = 1 - displayedMode;
        context.strokeStyle = layer.color;
        context.lineWidth = lineWidth;
        context.lineJoin = 'round';
        context.lineCap = 'round';
        context.stroke(line);
        context.fillStyle = layer.color;
        context.beginPath();
        context.arc(tipX, layerTipY, 3.5, 0, Math.PI * 2);
        context.fill();
        context.restore();
      };
      activeLayers.forEach(drawLayer);

      if (displayedMode > 0.01) {
        const candleSeconds = Math.max(1, config.candleSeconds ?? 10);
        const candles = aggregateCandles(primarySeries, startTime, candleSeconds);
        const candleWidth = Math.max(2, (plotWidth * candleSeconds) / windowSeconds * 0.68);
        context.save();
        context.globalAlpha = displayedMode;
        candles.forEach((candle) => {
          const x = xFor(candle.time + candleSeconds / 2);
          const rising = candle.close >= candle.open;
          context.strokeStyle = rising ? '#34d399' : '#fb7185';
          context.fillStyle = context.strokeStyle;
          context.beginPath();
          context.moveTo(x, yFor(candle.high));
          context.lineTo(x, yFor(candle.low));
          context.stroke();
          const top = yFor(Math.max(candle.open, candle.close));
          const bottom = yFor(Math.min(candle.open, candle.close));
          context.fillRect(x - candleWidth / 2, top, candleWidth, Math.max(1, bottom - top));
        });
        context.restore();
      }

      if (previousTickValue === undefined) previousTickValue = latest.value;
      if (!Object.is(previousTickValue, latest.value)) {
        previousMomentum = momentum;
        momentum = resolveMomentum(config.momentum, previousTickValue, latest.value);
        const moveRatio = Math.abs(latest.value - previousTickValue) / Math.max(Math.abs(previousTickValue), 1e-9);
        const threshold = degenConfig?.threshold ?? 0.002;
        if (degenConfig && momentum !== previousMomentum && moveRatio >= threshold) {
          const count = Math.max(1, degenConfig.particles ?? 18);
          for (let index = 0; index < count; index += 1) {
            const angle = (Math.PI * 2 * index) / count + Math.random() * 0.4;
            const speed = 28 + Math.random() * 70;
            particles.push({
              x: tipX,
              y: tipY,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 1,
              color: momentum === 'up' ? '#34d399' : '#fb7185',
            });
          }
        }
        previousTickValue = latest.value;
      } else if (typeof config.momentum === 'string') {
        momentum = config.momentum;
      }

      if (config.pulse !== false && activeLayers.length === 1) {
        context.save();
        context.strokeStyle = color;
        context.globalAlpha = 0.18 + 0.15 * Math.sin(frameTime / 180);
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(tipX, tipY, 7 + 3 * (1 + Math.sin(frameTime / 180)), 0, Math.PI * 2);
        context.stroke();
        context.restore();
      }

      if (config.momentum !== false && activeLayers.length === 1) {
        const momentumColor = momentum === 'up' ? '#34d399' : momentum === 'down' ? '#fb7185' : palette.label;
        context.fillStyle = momentumColor;
        context.beginPath();
        if (momentum === 'down') {
          context.moveTo(tipX + 10, tipY - 3);
          context.lineTo(tipX + 18, tipY - 3);
          context.lineTo(tipX + 14, tipY + 3);
        } else if (momentum === 'up') {
          context.moveTo(tipX + 10, tipY + 3);
          context.lineTo(tipX + 18, tipY + 3);
          context.lineTo(tipX + 14, tipY - 3);
        }
        context.closePath();
        context.fill();
      }

      if (config.showValue) {
        const valueColor = config.valueMomentumColor
          ? momentum === 'up' ? '#34d399' : momentum === 'down' ? '#fb7185' : palette.tooltip
          : palette.tooltip;
        context.fillStyle = valueColor;
        context.globalAlpha = 0.92;
        context.font = '700 28px system-ui, sans-serif';
        context.textAlign = 'left';
        context.fillText((config.formatValue ?? defaultFormatValue)(displayedValue), padding.left + 4, padding.top + 30);
        context.globalAlpha = 1;
      }

      if (config.badge !== false) {
        const text = (config.formatValue ?? defaultFormatValue)(displayedValue);
        context.font = '600 12px system-ui, sans-serif';
        const width = context.measureText(text).width + 18;
        const x = cssWidth - width - 4;
        const y = Math.min(cssHeight - 27, Math.max(3, tipY - 13));
        const minimal = config.badgeVariant === 'minimal';
        context.fillStyle = minimal ? (config.theme === 'light' ? '#ffffff' : '#f8fafc') : color;
        roundedRect(context, x, y, width, 26, 7);
        context.fill();
        if (config.badgeTail !== false) {
          context.beginPath();
          context.moveTo(x, y + 9);
          context.lineTo(x - 6, y + 13);
          context.lineTo(x, y + 17);
          context.closePath();
          context.fill();
        }
        context.fillStyle = minimal ? '#64748b' : '#fff';
        context.textAlign = 'center';
        context.fillText(text, x + width / 2, y + 17);
      }

      const hover = hoverRef.current;
      if (config.crosshair !== false && hover && hover.x >= padding.left && hover.x <= padding.left + plotWidth) {
        const hoverTime = startTime + ((hover.x - padding.left) / plotWidth) * windowSeconds;
        const point = series.findNearest(hoverTime);
        if (point && point.time >= startTime) {
          const x = xFor(point.time);
          const y = yFor(point.value);
          context.strokeStyle = palette.grid;
          context.setLineDash([4, 4]);
          context.beginPath();
          context.moveTo(x, padding.top);
          context.lineTo(x, padding.top + plotHeight);
          context.moveTo(padding.left, y);
          context.lineTo(padding.left + plotWidth, y);
          context.stroke();
          context.setLineDash([]);
          context.fillStyle = palette.tooltip;
          context.font = '12px system-ui, sans-serif';
          context.textAlign = 'left';
          const tooltip = `${(config.formatValue ?? defaultFormatValue)(point.value)} · ${(config.formatTime ?? defaultFormatTime)(point.time)}`;
          const tooltipX = padding.left + 5;
          const tooltipY = padding.top + (config.tooltipY ?? 14);
          if (config.tooltipOutline !== false) {
            context.strokeStyle = palette.background;
            context.lineWidth = 3;
            context.strokeText(tooltip, tooltipX, tooltipY);
          }
          context.fillText(tooltip, tooltipX, tooltipY);
        }
      }

      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index]!;
        particle.x += particle.vx * deltaSeconds;
        particle.y += particle.vy * deltaSeconds;
        particle.vy += 36 * deltaSeconds;
        particle.life -= deltaSeconds * 1.7;
        if (particle.life <= 0) {
          particles.splice(index, 1);
          continue;
        }
        context.globalAlpha = particle.life;
        context.fillStyle = particle.color;
        context.fillRect(particle.x, particle.y, 2.5, 2.5);
      }
      context.globalAlpha = 1;
      context.restore();

      if (!config.paused) frameRef.current = requestAnimationFrame(paint);
    };

    const schedule = () => {
      if (frameRef.current === undefined && document.visibilityState !== 'hidden') {
        frameRef.current = requestAnimationFrame(paint);
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      hoverRef.current = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      const config = optionsRef.current;
      if (config.onHover) {
        const windowSeconds = Math.max(1, config.windowSeconds ?? 30);
        const left = config.padding?.left ?? 12;
        const right = config.padding?.right ?? (config.badge === false ? 16 : 86);
        const plotWidth = Math.max(1, bounds.width - left - right);
        const time = (frozenTimeRef.current ?? Date.now() / 1_000)
          - windowSeconds
          + ((hoverRef.current.x - left) / plotWidth) * windowSeconds;
        const hoverSeries = config.layers?.find((layer) => layer.visible !== false)?.series ?? series;
        config.onHover(hoverSeries.findNearest(time));
      }
      schedule();
    };
    const onPointerLeave = () => {
      hoverRef.current = undefined;
      optionsRef.current.onHover?.(undefined);
      schedule();
    };
    const onVisibility = () => schedule();

    resize();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => {
      resize();
      schedule();
    });
    observer?.observe(canvas);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);
    const subscribedSeries = new Set([series, ...(options.layers?.map((layer) => layer.series) ?? [])]);
    const unsubscribes = [...subscribedSeries].map((source) => source.subscribe(schedule));
    schedule();

    return () => {
      disposed = true;
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
      frameRef.current = undefined;
      unsubscribes.forEach((unsubscribe) => unsubscribe());
      observer?.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [canvas, options.layers, options.paused, optionsRef, series]);

  return { canvasRef, canvas };
}
