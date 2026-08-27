import type { Landmark, VideoInfo } from "../contracts";
import { SAMPLE_FPS } from "./assets";
import { PoseClient } from "./pose-client";

export function samplingMetadata(
  name: string,
  width: number,
  height: number,
  duration: number,
  hash: string,
): VideoInfo {
  if (!Number.isFinite(duration) || duration <= 0 || width < 1 || height < 1)
    throw new Error(
      "Video metadata is invalid. Re-encode this clip as H.264 MP4.",
    );
  const count = Math.ceil(duration * SAMPLE_FPS);
  if (duration > 120 || count > 3600 || width * height > 3840 * 2160)
    throw new Error(
      "Processing limit: 120 seconds, 3,600 sampled frames and 4K. Trim or resize this clip.",
    );
  if (count < 3) throw new Error("Video is too short to analyze.");
  return {
    name,
    width,
    height,
    fps: SAMPLE_FPS,
    frame_count: count,
    duration_s: duration,
    sha256: hash,
    sampling_method: "browser-seek-30hz",
  };
}

function waitForVideo(
  video: HTMLVideoElement,
  eventName: string,
  signal: AbortSignal,
  action: () => void,
): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      video.removeEventListener(eventName, success);
      video.removeEventListener("error", failure);
      signal.removeEventListener("abort", abort);
    };
    const success = () => {
      cleanup();
      resolve();
    };
    const failure = () => {
      cleanup();
      reject(
        new Error(
          "This browser cannot decode the video. Try a supported H.264 MP4; no score was produced.",
        ),
      );
    };
    const abort = () => {
      cleanup();
      reject(
        new DOMException(
          "Analysis cancelled. No score was produced.",
          "AbortError",
        ),
      );
    };
    const timeout = setTimeout(failure, 25_000);
    video.addEventListener(eventName, success, { once: true });
    video.addEventListener("error", failure, { once: true });
    signal.addEventListener("abort", abort, { once: true });
    try {
      action();
    } catch {
      failure();
    }
  });
}

/** Seeking waits for decoding, rather than dropping frames when inference is slow.
 * The grid is explicit: it is not a claim of access to native encoded frames.
 */
export async function extractVideo(
  blob: Blob,
  name: string,
  hash: string,
  signal: AbortSignal,
  onProgress: (completed: number, total: number) => void,
) {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  const url = URL.createObjectURL(blob);
  let pose: PoseClient | undefined;
  try {
    await waitForVideo(video, "loadeddata", signal, () => {
      video.src = url;
      video.load();
    });
    const info = samplingMetadata(
      name,
      video.videoWidth,
      video.videoHeight,
      video.duration,
      hash,
    );
    onProgress(0, info.frame_count);
    pose = new PoseClient(signal);
    await pose.initialize();
    const history: (Landmark[] | null)[] = [];
    for (let i = 0; i < info.frame_count; i++) {
      signal.throwIfAborted();
      const time = i / SAMPLE_FPS;
      if (video.currentTime !== time)
        await waitForVideo(video, "seeked", signal, () => {
          video.currentTime = time;
        });
      const bitmap = await createImageBitmap(video);
      try {
        history.push(await pose.detect(bitmap, Math.floor(time * 1000)));
      } finally {
        bitmap.close();
      }
      onProgress(i + 1, info.frame_count);
    }
    return { history, info };
  } finally {
    pose?.close();
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
