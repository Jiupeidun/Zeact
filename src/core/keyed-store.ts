import { useCallback, useSyncExternalStore } from 'react';

export type StoreListener = () => void;

export interface KeyedStore<K, V> {
  get(key: K): V | undefined;
  getVersion(): number;
  set(key: K, value: V): void;
  setMany(entries: Iterable<readonly [K, V]>): void;
  delete(key: K): boolean;
  subscribe(key: K, listener: StoreListener): () => void;
  subscribeAll(listener: StoreListener): () => void;
}

/** A small external store that notifies only subscribers of changed keys. */
export function createKeyedStore<K, V>(initial?: Iterable<readonly [K, V]>): KeyedStore<K, V> {
  const values = new Map<K, V>(initial);
  const keyedListeners = new Map<K, Set<StoreListener>>();
  const allListeners = new Set<StoreListener>();
  let version = 0;

  const notify = (changed: Set<K>) => {
    version += 1;
    changed.forEach((key) => keyedListeners.get(key)?.forEach((listener) => listener()));
    allListeners.forEach((listener) => listener());
  };

  return {
    get: (key) => values.get(key),
    getVersion: () => version,
    set(key, value) {
      if (Object.is(values.get(key), value)) return;
      values.set(key, value);
      notify(new Set([key]));
    },
    setMany(entries) {
      const changed = new Set<K>();
      for (const [key, value] of entries) {
        if (Object.is(values.get(key), value)) continue;
        values.set(key, value);
        changed.add(key);
      }
      if (changed.size > 0) notify(changed);
    },
    delete(key) {
      if (!values.delete(key)) return false;
      notify(new Set([key]));
      return true;
    },
    subscribe(key, listener) {
      const listeners = keyedListeners.get(key) ?? new Set<StoreListener>();
      listeners.add(listener);
      keyedListeners.set(key, listeners);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) keyedListeners.delete(key);
      };
    },
    subscribeAll(listener) {
      allListeners.add(listener);
      return () => allListeners.delete(listener);
    },
  };
}

export function useKeyedValue<K, V>(store: KeyedStore<K, V>, key: K, serverValue?: V): V | undefined {
  const subscribe = useCallback((listener: StoreListener) => store.subscribe(key, listener), [key, store]);
  const getSnapshot = useCallback(() => store.get(key), [key, store]);
  const getServerSnapshot = useCallback(() => serverValue, [serverValue]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
