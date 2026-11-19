import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { AlertTriangle } from 'lucide-react';

/** HLS player. Appends CloudFront signed query params to every request when the backend provides them. */
export default function VideoPlayer({ playback, startAt = 0, onProgress, onEnded }) {
  const ref = useRef(null);
  const [error, setError] = useState('');
  const last = useRef(0);

  useEffect(() => {
    const video = ref.current; if (!video || !playback) return undefined;
    setError('');
    let hls;
    const seek = () => { if (startAt > 2) video.currentTime = startAt; };
    if (Hls.isSupported()) {
      hls = new Hls({
        xhrSetup: playback.signedQuery ? (xhr, url) => { if (!url.includes('Signature=')) xhr.open('GET', `${url}${url.includes('?') ? '&' : '?'}${playback.signedQuery}`, true); } : undefined,
      });
      hls.loadSource(playback.provider === 'cloudfront' ? playback.baseUrl : playback.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, seek);
      hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) setError('Playback error. The link may have expired — reload the lesson.'); });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playback.url; video.addEventListener('loadedmetadata', seek, { once: true });
    } else setError('This browser cannot play HLS video.');
    return () => hls?.destroy();
  }, [playback?.url]); // eslint-disable-line react-hooks/exhaustive-deps

  const report = (force) => {
    const v = ref.current; if (!v || !onProgress) return;
    if (force || Math.abs(v.currentTime - last.current) >= 10) { last.current = v.currentTime; onProgress(v.currentTime, v.duration || 0); }
  };

  if (error) return <div className="grid aspect-video place-items-center rounded-xl bg-stone-900 p-6 text-center text-stone-200"><div><AlertTriangle className="mx-auto h-8 w-8 text-amber-400" /><p className="mt-2 text-sm">{error}</p></div></div>;
  return <video ref={ref} controls playsInline className="aspect-video w-full rounded-xl bg-black" onTimeUpdate={() => report(false)} onPause={() => report(true)} onEnded={() => { report(true); onEnded?.(); }} />;
}
