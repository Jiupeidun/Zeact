import { describe, expect, it } from 'vitest';
import { createRealtimeSeries } from '../src/trade/time-series';
import { aggregateCandles } from '../src/trade/use-realtime-line-chart';

describe('aggregateCandles', () => {
  it('creates OHLC buckets from a tick series', () => {
    const series = createRealtimeSeries(16);
    [
      { time: 10, value: 100 },
      { time: 12, value: 105 },
      { time: 14, value: 98 },
      { time: 16, value: 102 },
      { time: 21, value: 110 },
      { time: 24, value: 108 },
    ].forEach((point) => series.append(point));

    expect(aggregateCandles(series, 0, 10)).toEqual([
      { time: 10, open: 100, high: 105, low: 98, close: 102 },
      { time: 20, open: 110, high: 110, low: 108, close: 108 },
    ]);
  });
});
