import { useCallback, useEffect, useRef } from 'react';
import { useRafState } from './use-raf-state';

export interface ElementSize {
  width: number;
  height: number;
}

const EMPTY_SIZE: ElementSize = { width: 0, height: 0 };

export function useElementSize<T extends Element>() {
  const elementRef = useRef<T | null>(null);
  const observerRef = useRef<ResizeObserver>();
  const [size, setSize] = useRafState<ElementSize>(EMPTY_SIZE);

  const ref = useCallback((element: T | null) => {
    observerRef.current?.disconnect();
    elementRef.current = element;
    if (!element || typeof ResizeObserver === 'undefined') return;

    observerRef.current = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((current) => current.width === width && current.height === height ? current : { width, height });
    });
    observerRef.current.observe(element);
  }, [setSize]);

  useEffect(() => () => observerRef.current?.disconnect(), []);
  return { ref, elementRef, size } as const;
}
