import type {
  AnalysisConfig,
  Landmark,
  SignalFrame,
  VideoInfo,
} from "../contracts";
import { angle, mean, trunkLean, type Point } from "./math";

export const JOINTS = {
  left: { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27 },
  right: { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28 },
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
  if (!frame || quality < config.min_visibility)
    return { quality, raw: [null, null, null, null] };
  const point = (joint: keyof typeof ids): Point => [
    frame[ids[joint]].x *
      (config.coordinate_mode === "pixel" ? video.width : 1) *
      (mirror ? -1 : 1),
    frame[ids[joint]].y *
      (config.coordinate_mode === "pixel" ? video.height : 1),
  ];
  const raw = [
    angle(point("hip"), point("knee"), point("ankle")),
    angle(point("shoulder"), point("hip"), point("knee")),
    angle(point("shoulder"), point("elbow"), point("wrist")),
    trunkLean(point("shoulder"), point("hip")),
  ].map((value) => (Number.isFinite(value) ? value : null));
  return { quality, raw };
}
