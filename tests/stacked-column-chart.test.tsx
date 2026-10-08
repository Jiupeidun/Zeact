import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  niceStackedColumnMax, stackedColumnTotal, StackedColumnChart,
  type StackedColumnDatum, type StackedColumnLayer,
} from '../src/trade/stacked-column-chart';

const layers: StackedColumnLayer[] = [
  { id: 'pullups', label: 'Pull-ups', color: '#7856ff' },
  { id: 'squats', label: 'Squats', color: '#00ba7c' },
  { id: 'kegels', label: 'Kegels', color: '#f45d22' },
];
const data: StackedColumnDatum[] = [
  { time: 100, values: { pullups: 24, squats: 20, kegels: 10 } },
  { time: 200, values: { pullups: 12, squats: 40, kegels: 20 } },
];

describe('StackedColumnChart', () => {
  it('adds finite positive layer values and chooses a readable scale', () => {
    expect(stackedColumnTotal(data[0]!, layers)).toBe(54);
    expect(stackedColumnTotal({ time: 1, values: { pullups: -3, squats: Number.NaN, kegels: 10 } }, layers)).toBe(10);
    expect(niceStackedColumnMax(72)).toBe(100);
    expect(niceStackedColumnMax(0)).toBe(1);
  });

  it('renders native stacked segments, legend, windows and precise accessible totals', () => {
    const onWindowChange = vi.fn();
    const { container } = render(<div style={{ height: 360 }}><StackedColumnChart
      data={data}
      layers={layers}
      theme="light"
      ariaLabel="Daily training volume"
      windows={[{ label: 'All', seconds: 1_000 }, { label: '30D', seconds: 30 }]}
      onWindowChange={onWindowChange}
      formatTime={(time) => `T${time}`}
      formatValue={(value) => `${value} reps`}
    /></div>);

    expect(screen.getByRole('img', { name: 'Daily training volume' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'T100: 54 reps total' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'T200: 72 reps total' })).toBeTruthy();
    expect(container.querySelectorAll('rect[fill="#7856ff"]')).toHaveLength(2);
    expect(container.querySelectorAll('rect[fill="#00ba7c"]')).toHaveLength(2);
    expect(container.querySelectorAll('rect[fill="#f45d22"]')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '30D' }));
    expect(onWindowChange).toHaveBeenCalledWith(30);
  });
});
