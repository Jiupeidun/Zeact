import { describe, expect, it, vi } from 'vitest';
import { createRealtimeSeries } from '../src/trade/time-series';

describe('createRealtimeSeries', () => {
  it('uses fixed memory and preserves chronological order', () => {
    const series = createRealtimeSeries(3);
    series.append({ time: 1, value: 10 });
    series.append({ time: 2, value: 20 });
    series.append({ time: 3, value: 30 });
    series.append({ time: 4, value: 40 });

    const points: number[] = [];
    series.forEachSince(0, (time) => points.push(time));
    expect(points).toEqual([2, 3, 4]);
    expect(series.first()).toEqual({ time: 2, value: 20 });
    expect(series.last()).toEqual({ time: 4, value: 40 });
  });

  it('replaces equal timestamps, rejects stale ticks and finds nearest values', () => {
    const series = createRealtimeSeries(4);
    const listener = vi.fn();
    series.subscribe(listener);
    series.append({ time: 10, value: 1 });
    expect(series.append({ time: 10, value: 2 })).toBe('replaced');
    expect(series.append({ time: 9, value: 3 })).toBe('ignored');
    series.append({ time: 20, value: 4 });

    expect(series.length).toBe(2);
    expect(series.findNearest(14)).toEqual({ time: 10, value: 2 });
    expect(series.findNearest(17)).toEqual({ time: 20, value: 4 });
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
