import { useCallback } from 'react';
import { useLatest } from './use-latest';

export function useStableCallback<Args extends unknown[], Result>(
  callback: (...args: Args) => Result,
): (...args: Args) => Result {
  const callbackRef = useLatest(callback);
  return useCallback((...args: Args) => callbackRef.current(...args), [callbackRef]);
}
