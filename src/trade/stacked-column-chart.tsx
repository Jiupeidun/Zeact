import {
  useId, useMemo, type CSSProperties, type FocusEvent, type PointerEvent, type ReactNode,
} from 'react';
import { useRafState } from '../hooks/use-raf-state';
import type { ChartPadding, ChartTheme } from './use-realtime-line-chart';
import { useChartControls } from './use-chart-controls';
import type { ChartWindowOption } from './realtime-line-chart';

export interface StackedColumnLayer {
  id: string;
  label?: string;
  color: string;
}

export interface StackedColumnDatum {
  time: number;
  values: Readonly<Record<string, number | undefined>>;
}

export interface StackedColumnHover {
  datum: StackedColumnDatum;
  total: number;
}

export interface StackedColumnPalette {
  background: string;
  grid: string;
  label: string;
  tooltip: string;
  panel: string;
}

export interface StackedColumnChartProps {
  data: readonly StackedColumnDatum[];
  layers: readonly StackedColumnLayer[];
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  theme?: ChartTheme;
  palette?: Partial<StackedColumnPalette>;
  grid?: boolean;
  showLegend?: boolean;
  showTotals?: boolean | 'auto';
  emptyText?: string;
  windowSeconds?: number;
  windows?: readonly ChartWindowOption[];
  windowStyle?: 'default' | 'rounded' | 'text';
  onWindowChange?: (seconds: number) => void;
  onHover?: (point: StackedColumnHover | undefined) => void;
  formatValue?: (value: number) => string;
  formatTime?: (unixSeconds: number) => string;
  renderTooltip?: (point: StackedColumnHover) => ReactNode;
  padding?: Partial<ChartPadding>;
}

const WIDTH = 920;
const HEIGHT = 360;
const DEFAULT_PADDING: ChartPadding = { top: 54, right: 58, bottom: 42, left: 48 };
const DARK = { background: '#0a0f18', grid: 'rgba(148,163,184,.14)', label: '#8b98ad', tooltip: '#f8fafc', panel: 'rgba(15,23,42,.94)' };
const LIGHT = { background: '#ffffff', grid: 'rgba(71,85,105,.16)', label: '#64748b', tooltip: '#0f172a', panel: 'rgba(255,255,255,.96)' };

const defaultFormatValue = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });
const defaultFormatTime = (time: number) => new Date(time * 1_000).toLocaleDateString();

export function clientXToStackedColumnViewBox(
  clientX: number,
  bounds: Pick<DOMRect, 'height' | 'left' | 'width'>,
) {
  const scale = Math.min(bounds.width / WIDTH, bounds.height / HEIGHT);
  if (!Number.isFinite(scale) || scale <= 0) return 0;
  const renderedWidth = WIDTH * scale;
  const horizontalInset = Math.max(0, (bounds.width - renderedWidth) / 2);
  return (clientX - bounds.left - horizontalInset) / scale;
}

function layerValue(datum: StackedColumnDatum, id: string) {
  const value = datum.values[id];
  return Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;
}

export function stackedColumnTotal(datum: StackedColumnDatum, layers: readonly StackedColumnLayer[]) {
  return layers.reduce((total, layer) => total + layerValue(datum, layer.id), 0);
}

export function niceStackedColumnMax(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function uniqueTickIndexes(length: number) {
  if (length <= 1) return [0];
  const tickCount = Math.min(5, length);
  return [...new Set(Array.from({ length: tickCount }, (_, index) => (
    Math.round(index * (length - 1) / Math.max(1, tickCount - 1))
  )))];
}

export function StackedColumnChart(props: StackedColumnChartProps) {
  const {
    data,
    layers,
    className,
    style,
    ariaLabel = 'Stacked column chart',
    theme = 'dark',
    palette: paletteOverrides,
    grid = true,
    showLegend = true,
    showTotals = 'auto',
    emptyText = 'No data',
    windows,
    windowStyle = 'default',
    onWindowChange,
    onHover,
    formatValue = defaultFormatValue,
    formatTime = defaultFormatTime,
    renderTooltip,
  } = props;
  const controls = useChartControls({ initialWindowSeconds: props.windowSeconds ?? windows?.[0]?.seconds ?? Number.POSITIVE_INFINITY });
  const effectiveWindow = props.windowSeconds ?? controls.windowSeconds;
  const [activeTime, setActiveTime] = useRafState<number | null>(null);
  const titleId = useId();
  const palette = { ...(theme === 'light' ? LIGHT : DARK), ...paletteOverrides };
  const padding = { ...DEFAULT_PADDING, ...props.padding };
  const plotWidth = WIDTH - padding.left - padding.right;
  const plotHeight = HEIGHT - padding.top - padding.bottom;
  const sorted = useMemo(() => [...data]
    .filter((datum) => Number.isFinite(datum.time))
    .sort((left, right) => left.time - right.time), [data]);
  const visible = useMemo(() => {
    const end = sorted.at(-1)?.time;
    if (end === undefined || !Number.isFinite(effectiveWindow)) return sorted;
    const start = end - Math.max(1, effectiveWindow);
    return sorted.filter((datum) => datum.time >= start);
  }, [effectiveWindow, sorted]);
  const totals = useMemo(() => visible.map((datum) => stackedColumnTotal(datum, layers)), [layers, visible]);
  const yMax = niceStackedColumnMax(Math.max(...totals, 0));
  const firstTime = visible[0]?.time ?? 0;
  const lastTime = visible.at(-1)?.time ?? firstTime;
  const timeRange = Math.max(1, lastTime - firstTime);
  const xFor = (time: number) => visible.length === 1
    ? padding.left + plotWidth / 2
    : padding.left + ((time - firstTime) / timeRange) * plotWidth;
  const yFor = (value: number) => padding.top + plotHeight - (value / yMax) * plotHeight;
  const xPositions = visible.map((datum) => xFor(datum.time));
  const minimumGap = xPositions.length < 2
    ? 32
    : xPositions.slice(1).reduce((minimum, x, index) => Math.min(minimum, x - xPositions[index]!), Number.POSITIVE_INFINITY);
  const barWidth = Math.max(3, Math.min(34, minimumGap * .68));
  const activeIndex = activeTime === null ? -1 : visible.findIndex((datum) => datum.time === activeTime);
  const activeDatum = activeIndex < 0 ? undefined : visible[activeIndex];
  const active = activeDatum ? { datum: activeDatum, total: totals[activeIndex] ?? 0 } : undefined;
  const gridTicks = [0, .25, .5, .75, 1];
  const tickIndexes = uniqueTickIndexes(visible.length);
  const totalsVisible = showTotals === true || (showTotals === 'auto' && visible.length <= 24);

  const setActive = (datum: StackedColumnDatum | undefined) => {
    setActiveTime(datum?.time ?? null);
    onHover?.(datum ? { datum, total: stackedColumnTotal(datum, layers) } : undefined);
  };
  const inspect = (event: PointerEvent<SVGSVGElement>) => {
    if (visible.length === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = clientXToStackedColumnViewBox(event.clientX, bounds);
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    xPositions.forEach((x, index) => {
      const distance = Math.abs(x - pointerX);
      if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = index; }
    });
    setActive(visible[nearestIndex]);
  };
  const focusDatum = (event: FocusEvent<SVGGElement>, datum: StackedColumnDatum) => {
    if (event.currentTarget === event.target) setActive(datum);
  };
  const buttonStyle = (selected: boolean): CSSProperties => ({
    background: selected ? 'rgba(82,113,255,.9)' : theme === 'light' ? 'rgba(241,245,249,.94)' : 'rgba(15,23,42,.82)',
    border: windowStyle === 'text' ? 0 : `1px solid ${palette.grid}`,
    borderRadius: windowStyle === 'rounded' ? 999 : 6,
    color: selected ? '#fff' : palette.label,
    cursor: 'pointer',
    font: '600 11px system-ui, sans-serif',
    padding: windowStyle === 'text' ? '4px 5px' : '5px 8px',
  });

  return <div className={className} style={{ height: '100%', position: 'relative', width: '100%', ...style }}>
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={ariaLabel}
      onPointerMove={inspect}
      onPointerDown={inspect}
      onPointerLeave={() => setActive(undefined)}
      style={{ display: 'block', height: '100%', touchAction: 'none', width: '100%' }}
    >
      <title id={titleId}>{ariaLabel}</title>
      <rect width={WIDTH} height={HEIGHT} fill={palette.background} />
      {visible.length === 0 ? <text x={WIDTH / 2} y={HEIGHT / 2} fill={palette.label} fontSize="13" textAnchor="middle">{emptyText}</text> : <>
        {grid && gridTicks.map((fraction) => {
          const y = padding.top + plotHeight * (1 - fraction);
          return <g key={fraction}><line x1={padding.left} x2={padding.left + plotWidth} y1={y} y2={y} stroke={palette.grid} /><text x={WIDTH - 5} y={y + 4} fill={palette.label} fontSize="11" textAnchor="end">{formatValue(yMax * fraction)}</text></g>;
        })}
        {visible.map((datum, datumIndex) => {
          const x = xPositions[datumIndex]!;
          let cumulative = 0;
          const total = totals[datumIndex] ?? 0;
          return <g
            key={datum.time}
            role="button"
            tabIndex={0}
            aria-label={`${formatTime(datum.time)}: ${formatValue(total)} total`}
            onFocus={(event) => focusDatum(event, datum)}
            onBlur={() => setActive(undefined)}
          >
            {layers.map((layer) => {
              const value = layerValue(datum, layer.id);
              const segmentTop = yFor(cumulative + value);
              const segmentBottom = yFor(cumulative);
              cumulative += value;
              return value === 0 ? null : <rect key={layer.id} x={x - barWidth / 2} y={segmentTop} width={barWidth} height={Math.max(1, segmentBottom - segmentTop)} fill={layer.color} />;
            })}
            {totalsVisible && total > 0 ? <text x={x} y={Math.max(padding.top + 10, yFor(total) - 6)} fill={palette.tooltip} fontSize="10" fontWeight="700" textAnchor="middle">{formatValue(total)}</text> : null}
            <rect x={x - Math.max(9, barWidth) / 2} y={padding.top} width={Math.max(9, barWidth)} height={plotHeight} fill="transparent" />
          </g>;
        })}
        {tickIndexes.map((index) => {
          const datum = visible[index];
          if (!datum) return null;
          return <text key={datum.time} x={xPositions[index]} y={HEIGHT - 13} fill={palette.label} fontSize="11" textAnchor={index === 0 ? 'start' : index === visible.length - 1 ? 'end' : 'middle'}>{formatTime(datum.time)}</text>;
        })}
        {activeDatum ? <line x1={xPositions[activeIndex]} x2={xPositions[activeIndex]} y1={padding.top} y2={padding.top + plotHeight} stroke={palette.tooltip} strokeDasharray="4 4" opacity=".55" /> : null}
      </>}
    </svg>
    {showLegend ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, left: padding.left / WIDTH * 100 + '%', position: 'absolute', top: 9 }} aria-hidden="true">
      {layers.map((layer) => <span key={layer.id} style={{ alignItems: 'center', color: palette.label, display: 'inline-flex', font: '600 11px system-ui, sans-serif', gap: 5 }}><i style={{ background: layer.color, display: 'inline-block', height: 8, width: 8 }} />{layer.label ?? layer.id}</span>)}
    </div> : null}
    {windows?.length ? <div style={{ display: 'flex', gap: 5, position: 'absolute', right: 8, top: 8 }}>
      {windows.map((option) => <button key={option.seconds} type="button" style={buttonStyle(effectiveWindow === option.seconds)} onClick={() => { controls.setWindowSeconds(option.seconds); onWindowChange?.(option.seconds); }}>{option.label}</button>)}
    </div> : null}
    {active ? <div style={{ background: palette.panel, border: `1px solid ${palette.grid}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.18)', color: palette.tooltip, left: `${xPositions[activeIndex]! / WIDTH * 100}%`, maxWidth: 240, padding: '9px 11px', pointerEvents: 'none', position: 'absolute', top: 46, transform: activeIndex < visible.length * .25 ? 'translateX(0)' : activeIndex > visible.length * .75 ? 'translateX(-100%)' : 'translateX(-50%)', zIndex: 2 }}>
      {renderTooltip ? renderTooltip(active) : <><strong style={{ display: 'block', font: '700 12px system-ui, sans-serif', marginBottom: 6 }}>{formatTime(active.datum.time)} · {formatValue(active.total)} total</strong>{layers.map((layer) => <span key={layer.id} style={{ alignItems: 'center', color: palette.label, display: 'flex', font: '11px system-ui, sans-serif', gap: 6, justifyContent: 'space-between', minWidth: 120 }}><i style={{ background: layer.color, height: 7, width: 7 }} /><span style={{ flex: 1 }}>{layer.label ?? layer.id}</span><b style={{ color: palette.tooltip }}>{formatValue(layerValue(active.datum, layer.id))}</b></span>)}</>}
    </div> : null}
  </div>;
}
