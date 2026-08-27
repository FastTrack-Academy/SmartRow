import type {
  AnalysisConfig,
  Landmark,
  Stroke,
  VideoAnalysis,
  VideoInfo,
} from "../contracts";
import { extractFeatures, selectSide } from "./features";
import { findPeaks, gaussian, interpolate, mean, resample } from "./math";

export const DEFAULT_CONFIG: AnalysisConfig = {
  coordinate_mode: "pixel",
  mirror_candidate: false,
  smoothing_sigma: 2,
  min_stroke_seconds: 2,
  catch_prominence: 15,
  min_visibility: 0.35,
  interpolation_limit: 5,
  drive_points: 40,
  recovery_points: 60,
};

export function preprocess(raw: (number | null)[][], config: AnalysisConfig) {
  const columns = [0, 1, 2, 3].map((j) =>
    interpolate(
      raw.map((row) => row[j] ?? NaN),
      config.interpolation_limit,
    ),
  );
  if (!columns.every((column) => column.every(Number.isFinite))) {
    throw new Error(
      "Long or unusable pose gaps remain. Use a clear, full-body side-view clip; no score was produced.",
    );
  }
  const smoothed = columns.map((column) =>
    gaussian(column, config.smoothing_sigma),
  );
  return {
    processed: raw.map((_, i) => columns.map((column) => column[i])),
    smooth: raw.map((_, i) => smoothed.map((column) => column[i])),
  };
}

export function detectStrokes(
  smooth: number[][],
  fps: number,
  config: AnalysisConfig,
) {
  const knee = smooth.map((row) => row[0]);
  const catches = findPeaks(
    knee.map((value) => -value),
    Math.max(1, Math.trunc(config.min_stroke_seconds * fps)),
    config.catch_prominence,
  );
  const strokes: Stroke[] = [];
  for (let i = 0; i < catches.length - 1; i++) {
    const start = catches[i],
      end = catches[i + 1];
    let finish = start;
    for (let frame = start + 1; frame <= end; frame++)
      if (knee[frame] > knee[finish]) finish = frame;
    if (!(start < finish && finish < end)) continue;
    const duration = (end - start) / fps;
    strokes.push({
      id: strokes.length + 1,
      catch_frame: start,
      finish_frame: finish,
      next_catch_frame: end,
      cycle_seconds: duration,
      drive_seconds: (finish - start) / fps,
      recovery_seconds: (end - finish) / fps,
      strokes_per_minute: 60 / duration,
    });
  }
  if (!strokes.length)
    throw new Error(
      "No complete catch–finish–catch stroke was detected with the notebook parameters. Use a longer steady side-view clip; no score was produced.",
    );
  return { catches, strokes };
}

export function standardize(
  smooth: number[][],
  stroke: Stroke,
  config: AnalysisConfig,
): number[][] {
  const columns = [0, 1, 2, 3].map((j) => [
    ...resample(
      smooth
        .slice(stroke.catch_frame, stroke.finish_frame + 1)
        .map((row) => row[j]),
      config.drive_points,
    ),
    ...resample(
      smooth
        .slice(stroke.finish_frame, stroke.next_catch_frame + 1)
        .map((row) => row[j]),
      config.recovery_points + 1,
    ).slice(1),
  ]);
  return Array.from(
    { length: config.drive_points + config.recovery_points },
    (_, i) => columns.map((column) => column[i]),
  );
}

export function analyzeLandmarks(
  history: (Landmark[] | null)[],
  video: VideoInfo,
  config: AnalysisConfig,
  mirror = false,
): VideoAnalysis {
  if (!history.length || !history.some(Boolean))
    throw new Error(
      "No person was detected. Use a well-lit video with one visible rower.",
    );
  const side = selectSide(history);
  const rows = history.map((frame) =>
    extractFeatures(frame, side, video, config, mirror),
  );
  const { processed, smooth } = preprocess(
    rows.map((row) => row.raw),
    config,
  );
  const { catches, strokes } = detectStrokes(smooth, video.fps, config);
  const fingerprints = strokes.map((stroke) =>
    standardize(smooth, stroke, config),
  );
  const average = fingerprints[0].map((row, i) =>
    row.map((_, j) => mean(fingerprints.map((stroke) => stroke[i][j]))),
  );
  const std = average.map((row, i) =>
    row.map((value, j) =>
      Math.sqrt(
        mean(fingerprints.map((stroke) => (stroke[i][j] - value) ** 2)),
      ),
    ),
  );
  const interpolated = rows.filter((row) => row.raw.includes(null)).length;
  const warnings: string[] = [];
  if (interpolated)
    warnings.push(
      `${interpolated} sampled frames contain interpolated angle measurements, not direct observations.`,
    );
  if (strokes.length < 3)
    warnings.push(
      "Fewer than three complete strokes: this profile has very limited repeatability evidence.",
    );
  if (config.coordinate_mode === "notebook")
    warnings.push(
      "Notebook mode uses normalized x/y and can distort angles in non-square video. Do not interpret these values as calibrated image-plane angles.",
    );
  return {
    video,
    active_side: side,
    detection_coverage: history.filter(Boolean).length / history.length,
    measured_coverage: 1 - interpolated / history.length,
    interpolated_frames: interpolated,
    landmarks: history,
    signals: rows.map((row, i) => ({
      frame: i,
      time_s: i / video.fps,
      ...row,
      processed: processed[i],
      smooth: smooth[i],
    })),
    catches,
    strokes,
    fingerprints,
    mean: average,
    std,
    warnings,
  };
}
