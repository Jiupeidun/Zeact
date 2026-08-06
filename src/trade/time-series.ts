import type { StoreListener } from '../core/keyed-store';

export interface TimePoint {
  time: number;
  value: number;
}

export type AppendResult = 'appended' | 'replaced' | 'ignored';

export interface RealtimeSeries {
  readonly capacity: number;
  readonly length: number;
  readonly version: number;
  append(point: TimePoint): AppendResult;
  clear(): void;
  first(): TimePoint | undefined;
  last(): TimePoint | undefined;
  findNearest(time: number): TimePoint | undefined;
  forEachSince(time: number, visitor: (time: number, value: number, index: number) => void): void;
  subscribe(listener: StoreListener): () => void;
}

/** Fixed-memory, timestamp-ordered ring buffer for websocket tick streams. */
export function createRealtimeSeries(capacity = 4_096): RealtimeSeries {
  if (!Number.isInteger(capacity) || capacity < 2) {
    throw new RangeError('Realtime series capacity must be an integer greater than one.');
  }

  const times = new Float64Array(capacity);
  const values = new Float64Array(capacity);
  const listeners = new Set<StoreListener>();
  let start = 0;
  let size = 0;
  let revision = 0;

  const physicalIndex = (logicalIndex: number) => (start + logicalIndex) % capacity;
  const timeAt = (logicalIndex: number) => times[physicalIndex(logicalIndex)] ?? 0;
  const valueAt = (logicalIndex: number) => values[physicalIndex(logicalIndex)] ?? 0;
  const notify = () => {
    revision += 1;
    listeners.forEach((listener) => listener());
  };
  const pointAt = (logicalIndex: number): TimePoint | undefined => (
    logicalIndex < 0 || logicalIndex >= size
      ? undefined
      : { time: timeAt(logicalIndex), value: valueAt(logicalIndex) }
  );

  const lowerBound = (target: number) => {
    let low = 0;
    let high = size;
    while (low < high) {
      const middle = low + ((high - low) >> 1);
      if (timeAt(middle) < target) low = middle + 1;
      else high = middle;
    }
    return low;
  };

  return {
    capacity,
    get length() { return size; },
    get version() { return revision; },
    append({ time, value }) {
      if (!Number.isFinite(time) || !Number.isFinite(value)) return 'ignored';
      const latestTime = size === 0 ? -Infinity : timeAt(size - 1);
      if (time < latestTime) return 'ignored';

      if (time === latestTime && size > 0) {
        values[physicalIndex(size - 1)] = value;
        notify();
        return 'replaced';
      }

      if (size < capacity) {
        const target = physicalIndex(size);
        times[target] = time;
        values[target] = value;
        size += 1;
      } else {
        times[start] = time;
        values[start] = value;
        start = (start + 1) % capacity;
      }
      notify();
      return 'appended';
    },
    clear() {
      if (size === 0) return;
      start = 0;
      size = 0;
      notify();
    },
    first: () => pointAt(0),
    last: () => pointAt(size - 1),
    findNearest(time) {
      if (size === 0) return undefined;
      const right = lowerBound(time);
      if (right === 0) return pointAt(0);
      if (right === size) return pointAt(size - 1);
      const before = pointAt(right - 1)!;
      const after = pointAt(right)!;
      return time - before.time <= after.time - time ? before : after;
    },
    forEachSince(time, visitor) {
      const firstIndex = lowerBound(time);
      for (let index = firstIndex; index < size; index += 1) {
        visitor(timeAt(index), valueAt(index), index);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
