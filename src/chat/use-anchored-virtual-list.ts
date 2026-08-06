import {
  useCallback, useLayoutEffect, useMemo, useRef, useState,
  type RefCallback,
} from 'react';
import { useLatest } from '../hooks/use-latest';
import { useRafState } from '../hooks/use-raf-state';
import { SizeIndex } from './size-index';

export interface AnchoredListOptions<T, K> {
  items: readonly T[];
  getKey: (item: T) => K;
  estimateSize?: number;
  overscan?: number;
  followOutputThreshold?: number;
  initialAlignment?: 'start' | 'end';
}

export interface VirtualItem<T, K> {
  item: T;
  key: K;
  index: number;
  start: number;
  size: number;
  measureRef: RefCallback<HTMLElement>;
}

interface ViewState {
  start: number;
  end: number;
  atBottom: boolean;
  revision: number;
}

interface ScrollAnchor<K> {
  key: K;
  viewportOffset: number;
}

const DEFAULT_ESTIMATE = 72;

export function useAnchoredVirtualList<T, K>(options: AnchoredListOptions<T, K>) {
  const {
    items,
    getKey,
    estimateSize = DEFAULT_ESTIMATE,
    overscan = 6,
    followOutputThreshold = 48,
    initialAlignment = 'end',
  } = options;
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [view, setView] = useRafState<ViewState>({ start: 0, end: 0, atBottom: true, revision: 0 });
  const sizeCacheRef = useRef(new Map<K, number>());
  const elementsRef = useRef(new Map<K, HTMLElement>());
  const keyByElementRef = useRef(new WeakMap<HTMLElement, K>());
  const anchorRef = useRef<ScrollAnchor<K>>();
  const previousKeysRef = useRef<readonly K[]>([]);
  const wasAtBottomRef = useRef(true);
  const itemsRef = useLatest(items);
  const getKeyRef = useLatest(getKey);

  const keys = useMemo(() => items.map(getKey), [getKey, items]);
  const indexByKey = useMemo(() => new Map(keys.map((key, index) => [key, index])), [keys]);
  const sizeIndex = useMemo(() => {
    const index = new SizeIndex(items.length, estimateSize);
    keys.forEach((key, itemIndex) => {
      const measured = sizeCacheRef.current.get(key);
      if (measured !== undefined) index.update(itemIndex, measured);
    });
    return index;
  }, [estimateSize, items.length, keys]);
  const sizeIndexRef = useLatest(sizeIndex);
  const indexByKeyRef = useLatest(indexByKey);

  const recalculate = useCallback(() => {
    if (!container) return;
    const index = sizeIndexRef.current;
    const count = itemsRef.current.length;
    const firstVisible = count === 0 ? 0 : index.indexAt(container.scrollTop);
    const lastVisible = count === 0 ? 0 : index.indexAt(container.scrollTop + container.clientHeight);
    const atBottom = index.totalSize - container.scrollTop - container.clientHeight <= followOutputThreshold;

    if (count > 0) {
      const item = itemsRef.current[firstVisible];
      if (item !== undefined) {
        anchorRef.current = {
          key: getKeyRef.current(item),
          viewportOffset: index.offsetOf(firstVisible) - container.scrollTop,
        };
      }
    }
    wasAtBottomRef.current = atBottom;
    setView((current) => ({
      start: Math.max(0, firstVisible - overscan),
      end: Math.min(count, lastVisible + overscan + 1),
      atBottom,
      revision: current.revision + 1,
    }));
  }, [container, followOutputThreshold, getKeyRef, itemsRef, overscan, setView, sizeIndexRef]);

  useLayoutEffect(() => {
    if (!container) return undefined;
    recalculate();
    container.addEventListener('scroll', recalculate, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(recalculate);
    observer?.observe(container);
    return () => {
      container.removeEventListener('scroll', recalculate);
      observer?.disconnect();
    };
  }, [container, recalculate]);

  useLayoutEffect(() => {
    if (!container) return;
    const previousKeys = previousKeysRef.current;
    const appended = previousKeys.length > 0
      && keys.length > previousKeys.length
      && Object.is(previousKeys[previousKeys.length - 1], keys[previousKeys.length - 1]);

    const isInitialLayout = previousKeys.length === 0 && keys.length > 0;
    if ((isInitialLayout && initialAlignment === 'end') || (appended && wasAtBottomRef.current)) {
      container.scrollTop = Math.max(0, sizeIndex.totalSize - container.clientHeight);
    } else if (anchorRef.current) {
      const anchorIndex = indexByKey.get(anchorRef.current.key);
      if (anchorIndex !== undefined) {
        container.scrollTop = sizeIndex.offsetOf(anchorIndex) - anchorRef.current.viewportOffset;
      }
    }
    previousKeysRef.current = keys;
    recalculate();
  }, [container, indexByKey, initialAlignment, keys, recalculate, sizeIndex]);

  const itemObserver = useMemo(() => typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver((entries) => {
    let changed = false;
    for (const entry of entries) {
      const element = entry.target as HTMLElement;
      const key = keyByElementRef.current.get(element);
      if (key === undefined) continue;
      const index = indexByKeyRef.current.get(key);
      if (index === undefined) continue;
      const size = entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height;
      const delta = sizeIndexRef.current.update(index, size);
      if (delta === 0) continue;
      sizeCacheRef.current.set(key, size);
      const anchorIndex = anchorRef.current ? indexByKeyRef.current.get(anchorRef.current.key) : undefined;
      if (container && anchorIndex !== undefined && index < anchorIndex) container.scrollTop += delta;
      changed = true;
    }
    if (changed) recalculate();
  }), [container, indexByKeyRef, recalculate, sizeIndexRef]);

  useLayoutEffect(() => () => itemObserver?.disconnect(), [itemObserver]);

  const measureRef = useCallback((key: K): RefCallback<HTMLElement> => (element) => {
    const previous = elementsRef.current.get(key);
    if (previous) itemObserver?.unobserve(previous);
    if (!element) {
      elementsRef.current.delete(key);
      return;
    }
    elementsRef.current.set(key, element);
    keyByElementRef.current.set(element, key);
    itemObserver?.observe(element);
  }, [itemObserver]);

  const virtualItems = useMemo(() => {
    const result: VirtualItem<T, K>[] = [];
    for (let index = view.start; index < view.end; index += 1) {
      const item = items[index];
      const key = keys[index];
      if (item === undefined || key === undefined) continue;
      result.push({
        item,
        key,
        index,
        start: sizeIndex.offsetOf(index),
        size: sizeIndex.sizeOf(index),
        measureRef: measureRef(key),
      });
    }
    return result;
  }, [items, keys, measureRef, sizeIndex, view.end, view.revision, view.start]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    container?.scrollTo({ top: sizeIndexRef.current.totalSize, behavior });
  }, [container, sizeIndexRef]);

  return {
    containerRef: setContainer,
    virtualItems,
    totalSize: sizeIndex.totalSize,
    isAtBottom: view.atBottom,
    scrollToBottom,
    recalculate,
  } as const;
}
