import { useEffect } from 'react';
import { useLatest } from '../hooks/use-latest';

export interface VideoFrameInfo {
  now: number;
  mediaTime: number;
  presentedFrames?: number;
  width?: number;
  height?: number;
}

export interface VideoFrameOptions {
  enabled?: boolean;
  maxFps?: number;
  pauseWhenHidden?: boolean;
}

interface VideoFrameMetadataLike {
  mediaTime: number;
  presentedFrames?: number;
  width?: number;
  height?: number;
}

interface FrameVideoApi {
  requestVideoFrameCallback?: (callback: (now: number, metadata: VideoFrameMetadataLike) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
}

/** Samples rendered video frames without causing React renders. */
export function useVideoFrames(
  video: HTMLVideoElement | null,
  onFrame: (frame: VideoFrameInfo) => void,
  options: VideoFrameOptions = {},
): void {
  const { enabled = true, maxFps = 30, pauseWhenHidden = true } = options;
  const callbackRef = useLatest(onFrame);

  useEffect(() => {
    if (!video || !enabled) return undefined;
    const frameVideo = video as unknown as FrameVideoApi;
    const requestVideoFrame = frameVideo.requestVideoFrameCallback?.bind(video);
    const cancelVideoFrame = frameVideo.cancelVideoFrameCallback?.bind(video);
    const interval = 1000 / Math.max(1, maxFps);
    let lastCall = -Infinity;
    let handle: number | undefined;
    let cancelled = false;

    const shouldRun = () => !pauseWhenHidden || document.visibilityState === 'visible';
    const emit = (now: number, metadata?: VideoFrameMetadataLike) => {
      if (shouldRun() && now - lastCall >= interval) {
        lastCall = now;
        callbackRef.current({
          now,
          mediaTime: metadata?.mediaTime ?? video.currentTime,
          ...(metadata?.presentedFrames === undefined ? {} : { presentedFrames: metadata.presentedFrames }),
          ...(metadata?.width === undefined ? {} : { width: metadata.width }),
          ...(metadata?.height === undefined ? {} : { height: metadata.height }),
        });
      }
    };

    if (requestVideoFrame) {
      const loop = (now: number, metadata: VideoFrameMetadataLike) => {
        if (cancelled) return;
        emit(now, metadata);
        handle = requestVideoFrame(loop);
      };
      handle = requestVideoFrame(loop);
    } else {
      const loop = (now: number) => {
        if (cancelled) return;
        emit(now);
        handle = requestAnimationFrame(loop);
      };
      handle = requestAnimationFrame(loop);
    }

    return () => {
      cancelled = true;
      if (handle === undefined) return;
      if (cancelVideoFrame && requestVideoFrame) {
        cancelVideoFrame(handle);
      } else {
        cancelAnimationFrame(handle);
      }
    };
  }, [callbackRef, enabled, maxFps, pauseWhenHidden, video]);
}
