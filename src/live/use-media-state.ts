import { useCallback, useSyncExternalStore } from 'react';

export interface MediaState {
  currentTime: number;
  duration: number;
  ended: boolean;
  muted: boolean;
  paused: boolean;
  playbackRate: number;
  readyState: number;
  volume: number;
}

const SERVER_STATE: MediaState = {
  currentTime: 0,
  duration: 0,
  ended: false,
  muted: false,
  paused: true,
  playbackRate: 1,
  readyState: 0,
  volume: 1,
};

const EVENTS = [
  'durationchange', 'emptied', 'ended', 'loadedmetadata', 'pause', 'play',
  'ratechange', 'seeked', 'timeupdate', 'volumechange', 'waiting',
] as const;

function readMedia(element: HTMLMediaElement | null): MediaState {
  if (!element) return SERVER_STATE;
  return {
    currentTime: element.currentTime,
    duration: Number.isFinite(element.duration) ? element.duration : 0,
    ended: element.ended,
    muted: element.muted,
    paused: element.paused,
    playbackRate: element.playbackRate,
    readyState: element.readyState,
    volume: element.volume,
  };
}

export function useMediaState(element: HTMLMediaElement | null): MediaState {
  let cached = readMedia(element);
  const subscribe = useCallback((listener: () => void) => {
    if (!element) return () => undefined;
    const onChange = () => {
      cached = readMedia(element);
      listener();
    };
    EVENTS.forEach((event) => element.addEventListener(event, onChange));
    return () => EVENTS.forEach((event) => element.removeEventListener(event, onChange));
  }, [element]);
  const getSnapshot = useCallback(() => cached, [element]);
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_STATE);
}
