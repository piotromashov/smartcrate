import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

// Minimal typings for the bits of the YouTube IFrame Player API we use.
interface YTPlayer {
  loadVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  getCurrentTime(): number;
  destroy(): void;
}
interface YTStateEvent {
  data: number;
}
interface YTPlayerOptions {
  width?: string | number;
  height?: string | number;
  events?: {
    onReady?: () => void;
    onStateChange?: (e: YTStateEvent) => void;
  };
}
interface YTNamespace {
  Player: new (el: HTMLElement, opts: YTPlayerOptions) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

function loadApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YTNamespace>((resolve) => {
    window.onYouTubeIframeAPIReady = () => resolve(window.YT as YTNamespace);
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return apiPromise;
}

export interface PlayerHandle {
  containerRef: RefObject<HTMLDivElement>;
  ready: boolean;
  load(videoId: string): void;
  play(): void;
  pause(): void;
  getCurrentTime(): number;
}

/** Creates a single YouTube player inside a container div and reports track end. */
export function useYouTubePlayer(onEnded: () => void): PlayerHandle {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const onEndedRef = useRef(onEnded);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    const host = document.createElement('div');
    container.appendChild(host);

    void loadApi().then((YT) => {
      if (cancelled) return;
      playerRef.current = new YT.Player(host, {
        width: '100%',
        height: '220',
        events: {
          onReady: () => setReady(true),
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.ENDED) onEndedRef.current();
          },
        },
      });
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      container.innerHTML = '';
    };
  }, []);

  return {
    containerRef,
    ready,
    load: (videoId) => playerRef.current?.loadVideoById(videoId),
    play: () => playerRef.current?.playVideo(),
    pause: () => playerRef.current?.pauseVideo(),
    getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
  };
}
