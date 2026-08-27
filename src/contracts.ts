export type CoordinateMode = "pixel" | "notebook";
export interface AnalysisConfig {
  coordinate_mode: CoordinateMode;
  mirror_candidate: boolean;
  smoothing_sigma: number;
  min_stroke_seconds: number;
  catch_prominence: number;
  min_visibility: number;
  interpolation_limit: number;
  drive_points: number;
  recovery_points: number;
}
export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
  presence: number | null;
}
export interface VideoInfo {
  name: string;
  width: number;
  height: number;
  fps: number;
  frame_count: number;
  duration_s: number;
  sha256: string;
  /** v2: fps/frame_count describe the sampling grid, not the source encoding. */
  sampling_method?: "browser-seek-30hz";
}
export interface Stroke {
  id: number;
  catch_frame: number;
  finish_frame: number;
  next_catch_frame: number;
  cycle_seconds: number;
  drive_seconds: number;
  recovery_seconds: number;
  strokes_per_minute: number;
}
export interface SignalFrame {
  frame: number;
  time_s: number;
  quality: number;
  raw: (number | null)[];
  processed: number[];
  smooth: number[];
}
export interface VideoAnalysis {
  video: VideoInfo;
  active_side: "left" | "right";
  detection_coverage: number;
  measured_coverage: number;
  interpolated_frames: number;
  landmarks: (Landmark[] | null)[];
  signals: SignalFrame[];
  catches: number[];
  strokes: Stroke[];
  fingerprints: number[][][];
  mean: number[][];
  std: number[][];
  warnings: string[];
}
export interface FeatureComparison {
  feature: string;
  label: string;
  rmse_degrees: number;
  drive_rmse_degrees: number;
  recovery_rmse_degrees: number;
}
export interface ComparisonReport {
  schema_version: string;
  algorithm_version: string;
  created_at: string;
  provenance: Record<string, string>;
  config: AnalysisConfig;
  reference: VideoAnalysis;
  candidate: VideoAnalysis;
  features: FeatureComparison[];
  overall_rmse_degrees: number;
  per_stroke_rmse_degrees: number[];
  feedback: string[];
  limitations: string[];
  evidence_status: string;
}
export interface AnalysisProgress {
  stage: "loading" | "reference" | "candidate" | "comparing";
  message: string;
  completed?: number;
  total?: number;
}
export const FEATURE_LABELS = ["Knee", "Hip", "Elbow", "Trunk"] as const;
