import React, { forwardRef, lazy, Suspense } from 'react';
import { videoProvider } from '../../utils/videoSource';

const YouTubeVideo = lazy(() => import('youtube-video-element/react'));
const VimeoVideo = lazy(() => import('vimeo-video-element/react'));

/** The provider elements expose the same media controls/events as HTML video. */
export const VideoSurface = forwardRef<HTMLVideoElement, React.VideoHTMLAttributes<HTMLVideoElement> & { src: string }>(
  function VideoSurface(props, ref) {
    const provider = videoProvider(props.src);
    if (provider === 'html5') return <video {...props} ref={ref} />;
    const shared = {
      src: props.src, muted: props.muted, ref: (node: HTMLVideoElement | null) => { if (typeof ref === 'function') ref(node); else if (ref) ref.current = node; }, controls: props.controls ?? true, playsInline: true,
      preload: 'metadata' as const, className: props.className,
      style: { width: '100%', height: '100%', ...props.style },
      onError: props.onError, onPlay: props.onPlay, onPause: props.onPause,
      onEnded: props.onEnded, onTimeUpdate: props.onTimeUpdate,
      onLoadedMetadata: props.onLoadedMetadata, onDurationChange: props.onDurationChange,
    };
    return <Suspense fallback={<p role="status" className="text-petrolio p-6">Caricamento lettore video…</p>}>
      {provider === 'youtube'
        ? <YouTubeVideo {...shared} config={{ origin: window.location.origin, referrerpolicy: 'strict-origin-when-cross-origin' }} />
        : <VimeoVideo {...shared} />}
    </Suspense>;
  }
);
