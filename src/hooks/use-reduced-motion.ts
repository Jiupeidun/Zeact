import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export function useReducedMotion(): boolean {
  const getMedia = () => window.matchMedia(QUERY);
  return useSyncExternalStore(
    (listener) => {
      const media = getMedia();
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    },
    () => getMedia().matches,
    () => false,
  );
}
