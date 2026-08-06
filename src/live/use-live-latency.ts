import { useEffect } from 'react';
import { useRafState } from '../hooks/use-raf-state';

export interface LiveLatencyState {
  latency: number | undefined;
  liveEdge: number | undefined;
  isBehind: boolean;
}

const EMPTY: LiveLatencyState = { latency: undefined, liveEdge: undefined, isBehind: false };

export function useLiveLatency(
  media: HTMLMediaElement | null,
  behindThreshold = 8,
): LiveLatencyState {
  const [state, setState] = useRafState<LiveLatencyState>(EMPTY);

  useEffect(() => {
    if (!media) return undefined;
    const update = () => {
      if (media.seekable.length === 0) {
        setState(EMPTY);
        return;
      }
      const liveEdge = media.seekable.end(media.seekable.length - 1);
      const latency = Math.max(0, liveEdge - media.currentTime);
      setState({ latency, liveEdge, isBehind: latency > behindThreshold });
    };
    media.addEventListener('progress', update);
    media.addEventListener('timeupdate', update);
    media.addEventListener('seeked', update);
    update();
    return () => {
      media.removeEventListener('progress', update);
      media.removeEventListener('timeupdate', update);
      media.removeEventListener('seeked', update);
    };
  }, [behindThreshold, media, setState]);

  return state;
}
