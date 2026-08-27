import {
  FEATURE_LABELS,
  type AnalysisConfig,
  type ComparisonReport,
  type VideoAnalysis,
} from "../contracts";
import { mean } from "./math";

export const LIMITATIONS = [
  "RMSE measures similarity to this reference, not correctness, safety, or injury risk.",
  "This is a cross-video extension of a within-video notebook demonstration; coach validation is still TODO.",
  "One rower, fixed side view, visible whole body, comparable camera placement and facing direction are required; these conditions are not automatically verified.",
  "Camera perspective, body proportions, occlusion and pose-estimation error can change the measurements.",
  "Browser decoding samples at 30 Hz by seeking, not native source-frame extraction. Frames can repeat or be skipped; timing and browser model outputs are not interchangeable with the Python version.",
  "Stroke detection uses experimental notebook settings: 2 s minimum spacing, 15° prominence and sigma 2 sampled frames; these are not universal rowing thresholds.",
  "The 40/60 phase resampling removes timing differences from the angle comparison; inspect stroke timing separately.",
  "Neck and wrist analysis, a calibrated 0–100 score, and injury-related advice are not implemented or validated.",
];

export function compare(
  reference: VideoAnalysis,
  candidate: VideoAnalysis,
  config: AnalysisConfig,
  provenance: Record<string, string>,
): ComparisonReport {
  const errors = candidate.fingerprints.map((stroke) =>
    stroke.map((row, i) =>
      row.map((value, j) => (value - reference.mean[i][j]) ** 2),
    ),
  );
  const features = ["knee_angle", "hip_angle", "elbow_angle", "trunk_lean"].map(
    (feature, j) => ({
      feature,
      label: FEATURE_LABELS[j],
      rmse_degrees: Math.sqrt(
        mean(errors.flatMap((stroke) => stroke.map((row) => row[j]))),
      ),
      drive_rmse_degrees: Math.sqrt(
        mean(
          errors.flatMap((stroke) =>
            stroke.slice(0, config.drive_points).map((row) => row[j]),
          ),
        ),
      ),
      recovery_rmse_degrees: Math.sqrt(
        mean(
          errors.flatMap((stroke) =>
            stroke.slice(config.drive_points).map((row) => row[j]),
          ),
        ),
      ),
    }),
  );
  const largest = features.reduce((a, b) =>
    b.rmse_degrees > a.rmse_degrees ? b : a,
  );
  const phase =
    largest.drive_rmse_degrees >= largest.recovery_rmse_degrees
      ? "drive"
      : "recovery";
  const feedback = [
    `Review ${largest.label.toLowerCase()} motion first: it has the largest measured difference (${largest.rmse_degrees.toFixed(1)}° RMSE), with more difference during ${phase}. This is a review priority, not an identified fault.`,
    "Replay the selected stroke and check the tracked landmarks before interpreting the angle curves.",
    "Discuss visible differences with your coach. A single reference cannot establish an ideal or safe movement pattern.",
  ];
  const selfComparison = reference.video.sha256 === candidate.video.sha256;
  if (selfComparison)
    feedback.unshift(
      "Self-comparison check: the candidate and reference are the same file. Nonzero RMSE describes within-reference stroke variation, not independent athlete performance.",
    );
  return {
    schema_version: "2.0",
    algorithm_version: "lecture5-browser-30hz-v2",
    created_at: new Date().toISOString(),
    provenance,
    config,
    reference,
    candidate,
    features,
    overall_rmse_degrees: Math.sqrt(mean(errors.flat(2))),
    per_stroke_rmse_degrees: errors.map((stroke) =>
      Math.sqrt(mean(stroke.flat())),
    ),
    feedback,
    limitations: LIMITATIONS,
    evidence_status: selfComparison
      ? "Self-comparison software check; not independent evaluation."
      : "Measured video-derived estimates; not scientifically validated ratings.",
  };
}
