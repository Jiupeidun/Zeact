import { useSyncExternalStore } from 'react';

function subscribe(listener: () => void) {
  document.addEventListener('visibilitychange', listener);
  return () => document.removeEventListener('visibilitychange', listener);
}

function getSnapshot() {
  return document.visibilityState;
}

export function usePageVisibility(): DocumentVisibilityState {
  return useSyncExternalStore(subscribe, getSnapshot, () => 'visible');
}
