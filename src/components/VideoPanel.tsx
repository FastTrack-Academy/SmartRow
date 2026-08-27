import { forwardRef, useEffect, useRef, useState } from "react";
import type { VideoAnalysis } from "../contracts";

const CONNECTIONS = [
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 12],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];

export const VideoPanel = forwardRef<
  HTMLVideoElement,
  {
    src: string;
    poster?: string;
    label: string;
    analysis?: VideoAnalysis;
  }
>(function VideoPanel({ src, poster, label, analysis }, forwardedRef) {
  const ownRef = useRef<HTMLVideoElement | null>(null);
  const [frame, setFrame] = useState(0);
  const [overlay, setOverlay] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    setError(false);
    setFrame(0);
  }, [src]);
  useEffect(() => {
    if (!analysis || !overlay) return;
    let request: number;
    function tick() {
      if (ownRef.current)
        setFrame(
          Math.min(
            analysis!.landmarks.length - 1,
            Math.round(ownRef.current.currentTime * analysis!.video.fps),
          ),
        );
      request = requestAnimationFrame(tick);
    }
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [analysis, overlay]);
  const points = analysis?.landmarks[frame];
  return (
    <>
      <div className="video-frame">
        <video
          ref={(element) => {
            ownRef.current = element;
            if (typeof forwardedRef === "function") forwardedRef(element);
            else if (forwardedRef) forwardedRef.current = element;
          }}
          src={src}
          poster={poster}
          controls
          playsInline
          preload="metadata"
          aria-label={label}
          onError={() => setError(true)}
        />
        {overlay && points && analysis ? (
          <svg
            className="pose-overlay"
            viewBox={`0 0 ${analysis.video.width} ${analysis.video.height}`}
            aria-label="Estimated pose landmarks"
          >
            {CONNECTIONS.map(([a, b]) => (
              <line
                key={`${a}-${b}`}
                x1={points[a].x * analysis.video.width}
                y1={points[a].y * analysis.video.height}
                x2={points[b].x * analysis.video.width}
                y2={points[b].y * analysis.video.height}
                stroke="#6fffe1"
                strokeWidth="2.5"
                opacity={Math.min(points[a].visibility, points[b].visibility)}
              />
            ))}
            {[...new Set(CONNECTIONS.flat())].map((i) => (
              <circle
                key={i}
                cx={points[i].x * analysis.video.width}
                cy={points[i].y * analysis.video.height}
                r="3.2"
                fill="#ffffff"
                stroke="#147d80"
                opacity={points[i].visibility}
              />
            ))}
          </svg>
        ) : null}
      </div>
      {error ? (
        <p className="inline-warning">
          Your browser cannot decode this codec for playback or analysis. Choose
          a compatible H.264 MP4.
        </p>
      ) : null}
      {analysis ? (
        <div className="video-caption">
          <label>
            <input
              type="checkbox"
              checked={overlay}
              onChange={(event) => setOverlay(event.target.checked)}
            />{" "}
            Show pose estimates
          </label>
          <span>
            {analysis.video.duration_s.toFixed(1)} s ·{" "}
            {analysis.video.fps.toFixed(0)} Hz sampling
          </span>
        </div>
      ) : null}
    </>
  );
});
