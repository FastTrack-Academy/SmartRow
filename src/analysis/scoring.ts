import {
  FEATURE_DEFINITIONS,
  type AnalysisConfig,
  type ComparisonReport,
  type FeatureKey,
  type FeatureWeights,
  type VideoAnalysis,
} from "../contracts";
import { mean } from "./math";

/** Rank-sum conversion of the project ranking: trunk > elbow > neck > wrist > knee > hip. */
export const DEFAULT_WEIGHTS: FeatureWeights = {
  knee_angle: 2 / 21,
  hip_angle: 1 / 21,
  elbow_angle: 5 / 21,
  trunk_lean: 6 / 21,
  neck_proxy: 4 / 21,
  wrist_proxy: 3 / 21,
};

export const LIMITATIONS = [
  "RMSE measures similarity to this reference, not correctness, safety, or injury risk.",
  "This is a cross-video extension of a within-video notebook demonstration; coach validation is still TODO.",
  "One rower, fixed side view, visible whole body, comparable camera placement and facing direction are required; these conditions are not automatically verified.",
  "Camera perspective, body proportions, occlusion and pose-estimation error can change the measurements.",
  "Browser decoding samples at 30 Hz by seeking, not native source-frame extraction. Frames can repeat or be skipped; timing and browser model outputs are not interchangeable with the Python version.",
  "Stroke detection uses experimental notebook settings: 2 s minimum spacing, 15° prominence and sigma 2 sampled frames; these are not universal rowing thresholds.",
  "The 40/60 phase resampling removes timing differences from the angle comparison; inspect stroke timing separately.",
  "Neck and wrist are 2D landmark proxies, not anatomical joint measurements; their reliability and coaching relevance remain unvalidated.",
  "The editable rank-sum weights are a project hypothesis, not literature-derived clinical or performance importance coefficients.",
  "Absolute curve area is an experimental shape-difference diagnostic and is not an independent validated score.",
  "No calibrated 0–100 grade or injury-risk prediction is provided.",
];

function populationStd(values: number[]) {
  if (!values.length) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function absoluteArea(values: number[]) {
  if (values.length < 2) return 0;
  const step = 1 / (values.length - 1);
  return values
    .slice(1)
    .reduce((sum, value, i) => sum + ((values[i] + value) / 2) * step, 0);
}

export function normalizeWeights(weights: FeatureWeights): FeatureWeights {
  const entries = FEATURE_DEFINITIONS.map(({ key }) => [
    key,
    Number.isFinite(weights[key]) && weights[key] >= 0 ? weights[key] : 0,
  ] as const);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0)
    throw new Error("At least one feature weight must be greater than zero.");
  return Object.fromEntries(
    entries.map(([key, value]) => [key, value / total]),
  ) as FeatureWeights;
}

export function applyWeights(
  report: ComparisonReport,
  requestedWeights: FeatureWeights,
): ComparisonReport {
  const weights = normalizeWeights(requestedWeights);
  const featureIndex = Object.fromEntries(
    report.features.map((feature, index) => [feature.feature, index]),
  ) as Record<FeatureKey, number>;
  const perStroke = report.candidate.fingerprints.map((stroke) =>
    Math.sqrt(
      FEATURE_DEFINITIONS.reduce((sum, { key }) => {
        const j = featureIndex[key];
        const featureMse = mean(
          stroke.map((row, i) =>
            (row[j] - report.reference.mean[i][j]) ** 2,
          ),
        );
        return sum + weights[key] * featureMse;
      }, 0),
    ),
  );
  const weighted = Math.sqrt(
    FEATURE_DEFINITIONS.reduce((sum, { key }) => {
      const feature = report.features[featureIndex[key]];
      return sum + weights[key] * feature.rmse_degrees ** 2;
    }, 0),
  );
  const weightedFeatures = report.features.map((feature) => ({
    ...feature,
    weight: weights[feature.feature],
  }));
  const priority = weightedFeatures.reduce((a, b) =>
    b.weight * b.rmse_degrees ** 2 > a.weight * a.rmse_degrees ** 2 ? b : a,
  );
  const priorityPhase =
    priority.drive_rmse_degrees >= priority.recovery_rmse_degrees
      ? "drive"
      : "recovery";
  const feedback = [
    `Review ${priority.label.toLowerCase()} motion first: it has the largest weighted contribution using the displayed weights (${priority.rmse_degrees.toFixed(1)}° unweighted feature RMSE), with more difference during ${priorityPhase}. This is a review priority, not an identified fault.`,
    "Replay the selected stroke and check the tracked landmarks before interpreting the angle curves.",
    "Discuss visible differences with your coach. A single reference cannot establish an ideal or safe movement pattern.",
  ];
  if (report.reference.video.sha256 === report.candidate.video.sha256)
    feedback.unshift(
      "Self-comparison check: the candidate and reference are the same file. Nonzero RMSE describes within-reference stroke variation, not independent athlete performance.",
    );
  return {
    ...report,
    weights,
    features: weightedFeatures,
    weighted_rmse_degrees: weighted,
    per_stroke_weighted_rmse_degrees: perStroke,
    stroke_score_mean_degrees: mean(perStroke),
    stroke_score_std_degrees: populationStd(perStroke),
    feedback,
  };
}

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
  const features = FEATURE_DEFINITIONS.map(
    ({ key: feature, label }, j) => {
      const perStrokeRmse = errors.map((stroke) =>
        Math.sqrt(mean(stroke.map((row) => row[j]))),
      );
      const perStrokeArea = candidate.fingerprints.map((stroke) =>
        absoluteArea(
          stroke.map((row, i) => Math.abs(row[j] - reference.mean[i][j])),
        ),
      );
      return {
        feature,
        label,
        weight: DEFAULT_WEIGHTS[feature],
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
        stroke_rmse_mean_degrees: mean(perStrokeRmse),
        stroke_rmse_std_degrees: populationStd(perStrokeRmse),
        absolute_curve_area_degree_cycle: mean(perStrokeArea),
        stroke_area_std_degree_cycle: populationStd(perStrokeArea),
      };
    },
  );
  const selfComparison = reference.video.sha256 === candidate.video.sha256;
  const base: ComparisonReport = {
    schema_version: "3.0",
    algorithm_version: "lecture5-browser-30hz-v3",
    created_at: new Date().toISOString(),
    provenance,
    config,
    reference,
    candidate,
    features,
    weights: DEFAULT_WEIGHTS,
    weighted_rmse_degrees: 0,
    stroke_score_mean_degrees: 0,
    stroke_score_std_degrees: 0,
    per_stroke_weighted_rmse_degrees: [],
    overall_rmse_degrees: Math.sqrt(mean(errors.flat(2))),
    per_stroke_rmse_degrees: errors.map((stroke) =>
      Math.sqrt(mean(stroke.flat())),
    ),
    feedback: [],
    limitations: LIMITATIONS,
    evidence_status: selfComparison
      ? "Self-comparison software check; not independent evaluation."
      : "Measured video-derived estimates; not scientifically validated ratings.",
  };
  return applyWeights(base, DEFAULT_WEIGHTS);
}
