import type { Landmark } from "../contracts";

export type PoseRequest =
  | { type: "initialize"; modelHash: string }
  | { type: "frame"; bitmap: ImageBitmap; timestampMs: number };
export type PoseResponse =
  | { type: "ready" }
  | { type: "landmarks"; landmarks: Landmark[] | null }
  | { type: "error"; message: string };
