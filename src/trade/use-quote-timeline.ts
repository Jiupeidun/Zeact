import { useEffect, useMemo } from 'react';
import { useLatest } from '../hooks/use-latest';
import type { QuoteLike, QuoteStore } from './quote-store';
import { createRealtimeSeries, type RealtimeSeries } from './time-series';

export interface QuoteTimelineOptions<T> {
  capacity?: number;
  selectValue: (quote: T) => number;
  selectTime?: (quote: T) => number;
}

/** Pipes one quote symbol into a fixed-memory series without React state updates. */
export function useQuoteTimeline<T extends QuoteLike>(
  store: QuoteStore<T>,
  symbol: string,
  options: QuoteTimelineOptions<T>,
): RealtimeSeries {
  const { capacity = 4_096 } = options;
  const series = useMemo(() => createRealtimeSeries(capacity), [capacity, symbol]);
  const optionsRef = useLatest(options);

  useEffect(() => {
    const appendCurrent = () => {
      const quote = store.get(symbol);
      if (!quote) return;
      const value = optionsRef.current.selectValue(quote);
      const time = optionsRef.current.selectTime?.(quote) ?? Date.now() / 1_000;
      series.append({ time, value });
    };
    appendCurrent();
    return store.subscribe(symbol, appendCurrent);
  }, [optionsRef, series, store, symbol]);

  return series;
}
