import { useCallback, useEffect, useRef, useState } from 'react';
import { FrameScheduler } from '../core/frame-scheduler';

export type RafStateAction<T> = T | ((current: T) => T);

/** Like useState, but multiple writes in one frame produce one React update. */
export function useRafState<T>(initial: T | (() => T)) {
  const [state, setState] = useState(initial);
  const schedulerRef = useRef<FrameScheduler>();
  const pendingRef = useRef(state);
  schedulerRef.current ??= new FrameScheduler();

  const setRafState = useCallback((action: RafStateAction<T>) => {
    pendingRef.current = typeof action === 'function'
      ? (action as (current: T) => T)(pendingRef.current)
      : action;
    schedulerRef.current?.schedule(() => setState(pendingRef.current), 'state');
  }, []);

  useEffect(() => () => schedulerRef.current?.clear(), []);
  return [state, setRafState] as const;
}
