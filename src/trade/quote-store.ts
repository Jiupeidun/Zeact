import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { FrameScheduler } from '../core/frame-scheduler';
import { createKeyedStore, type StoreListener } from '../core/keyed-store';

export interface QuoteLike {
  symbol: string;
}

export interface QuoteStore<T extends QuoteLike> {
  push(update: Partial<T> & Pick<T, 'symbol'>): void;
  pushMany(updates: Iterable<Partial<T> & Pick<T, 'symbol'>>): void;
  flush(): void;
  remove(symbol: string): boolean;
  get(symbol: string): T | undefined;
  subscribe(symbol: string, listener: StoreListener): () => void;
  destroy(): void;
}

function shallowEqual(left: object | undefined, right: object): boolean {
  if (!left) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length
    && rightKeys.every((key) => Object.is(
      (left as Record<string, unknown>)[key],
      (right as Record<string, unknown>)[key],
    ));
}

/**
 * Keeps websocket-frequency mutations outside React and publishes at most one
 * immutable snapshot per symbol per animation frame.
 */
export function createQuoteStore<T extends QuoteLike>(initial: Iterable<T> = []): QuoteStore<T> {
  const values = createKeyedStore<string, T>([...initial].map((quote) => [quote.symbol, quote] as const));
  const pending = new Map<string, Partial<T> & Pick<T, 'symbol'>>();
  const scheduler = new FrameScheduler();

  const flush = () => {
    const changed: Array<readonly [string, T]> = [];
    pending.forEach((patch, symbol) => {
      const next = { ...values.get(symbol), ...patch } as T;
      if (!shallowEqual(values.get(symbol), next)) changed.push([symbol, next]);
    });
    pending.clear();
    values.setMany(changed);
  };

  const push = (update: Partial<T> & Pick<T, 'symbol'>) => {
    pending.set(update.symbol, { ...pending.get(update.symbol), ...update });
    scheduler.schedule(flush, 'quote-flush');
  };

  return {
    push,
    pushMany(updates) {
      for (const update of updates) pending.set(update.symbol, { ...pending.get(update.symbol), ...update });
      if (pending.size > 0) scheduler.schedule(flush, 'quote-flush');
    },
    flush() {
      scheduler.cancel('quote-flush');
      flush();
    },
    remove(symbol) {
      pending.delete(symbol);
      return values.delete(symbol);
    },
    get: values.get,
    subscribe: values.subscribe,
    destroy() {
      pending.clear();
      scheduler.clear();
    },
  };
}

export function useQuote<T extends QuoteLike>(store: QuoteStore<T>, symbol: string, serverQuote?: T): T | undefined {
  const subscribe = useCallback((listener: StoreListener) => store.subscribe(symbol, listener), [store, symbol]);
  const getSnapshot = useCallback(() => store.get(symbol), [store, symbol]);
  const getServerSnapshot = useCallback(() => serverQuote, [serverQuote]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useQuoteSelector<T extends QuoteLike, S>(
  store: QuoteStore<T>,
  symbol: string,
  selector: (quote: T | undefined) => S,
  serverQuote?: T,
): S {
  const quote = useQuote(store, symbol, serverQuote);
  return useMemo(() => selector(quote), [quote, selector]);
}
