import type {
  AnalysisConfig,
  Landmark,
  SignalFrame,
  VideoInfo,
} from "../contracts";
import { angle, mean, trunkLean, type Point } from "./math";

export const JOINTS = {
  left: {
    ear: 7,
    shoulder: 11,
    elbow: 13,
    wrist: 15,
    pinky: 17,
    index: 19,
    hip: 23,
    knee: 25,
    ankle: 27,
  },
  right: {
    ear: 8,
    shoulder: 12,
    elbow: 14,
    wrist: 16,
    pinky: 18,
    index: 20,
    hip: 24,
    knee: 26,
    ankle: 28,
  },
} as const;
export type Side = keyof typeof JOINTS;

export function selectSide(history: (Landmark[] | null)[]): Side {
  const visibility = (side: Side) => {
    const values = history.flatMap((frame) =>
      frame ? Object.values(JOINTS[side]).map((i) => frame[i].visibility) : [],
    );
    return values.length ? mean(values) : 0;
  };
  return visibility("left") >= visibility("right") ? "left" : "right";
}

export function extractFeatures(
  frame: Landmark[] | null,
  side: Side,
  video: VideoInfo,
  config: AnalysisConfig,
  mirror: boolean,
): Pick<SignalFrame, "quality" | "raw"> {
  const ids = JOINTS[side];
  const quality = frame
    ? mean(Object.values(ids).map((i) => frame[i].visibility))
    : 0;
  if (!frame) return { quality, raw: Array(6).fill(null) };
  const point = (joint: keyof typeof ids): Point => [
    frame[ids[joint]].x *
      (config.coordinate_mode === "pixel" ? video.width : 1) *
      (mirror ? -1 : 1),
    frame[ids[joint]].y *
      (config.coordinate_mode === "pixel" ? video.height : 1),
  ];
  const visible = (joints: (keyof typeof ids)[]) =>
    joints.every(
      (joint) => frame[ids[joint]].visibility >= config.min_visibility,
    );
  const hand: Point = [
    (point("pinky")[0] + point("index")[0]) / 2,
    (point("pinky")[1] + point("index")[1]) / 2,
  ];
  const measurements: [number, (keyof typeof ids)[]][] = [
    [angle(point("hip"), point("knee"), point("ankle")), ["hip", "knee", "ankle"]],
    [angle(point("shoulder"), point("hip"), point("knee")), ["shoulder", "hip", "knee"]],
    [angle(point("shoulder"), point("elbow"), point("wrist")), ["shoulder", "elbow", "wrist"]],
    [trunkLean(point("shoulder"), point("hip")), ["shoulder", "hip"]],
    [angle(point("ear"), point("shoulder"), point("hip")), ["ear", "shoulder", "hip"]],
    [angle(point("elbow"), point("wrist"), hand), ["elbow", "wrist", "pinky", "index"]],
  ];
  const raw = measurements.map(([value, joints]) =>
    visible(joints) && Number.isFinite(value) ? value : null,
  );
  return { quality, raw };
}
