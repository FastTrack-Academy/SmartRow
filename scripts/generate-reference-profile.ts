/** Rebuild the deployable coach profile from preserved measured landmarks. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Landmark, ReferenceProfileBundle, VideoInfo } from "../src/contracts";
import { MEDIAPIPE_VERSION, MODEL_SHA256 } from "../src/analysis/assets";
import { analyzeLandmarks, DEFAULT_CONFIG } from "../src/analysis/pipeline";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourcePath = path.join(
  root,
  "references/profiles/coach-reference-landmarks-web-v1.json",
);
const source = JSON.parse(await readFile(sourcePath, "utf8")) as {
  acquired_at: string;
  video: VideoInfo;
  landmarks: (Landmark[] | null)[];
  provenance: Record<string, string>;
};
if (source.provenance.model_sha256 !== MODEL_SHA256)
  throw new Error("Measured-landmark model hash does not match the pinned model.");
if (source.provenance.mediapipe !== MEDIAPIPE_VERSION)
  throw new Error("Measured-landmark MediaPipe version does not match the app.");

const analyses = Object.fromEntries(
  (["pixel", "notebook"] as const).map((coordinate_mode) => {
    const analysis = analyzeLandmarks(source.landmarks, source.video, {
      ...DEFAULT_CONFIG,
      coordinate_mode,
    });
    const { landmarks: _sharedLandmarks, ...cached } = analysis;
    return [coordinate_mode, cached];
  }),
) as ReferenceProfileBundle["analyses"];
const bundle: ReferenceProfileBundle = {
  reference_profile_schema: "1.0",
  algorithm_version: "lecture5-browser-30hz-v3",
  generated_at: new Date().toISOString(),
  reference_sha256: source.video.sha256,
  model_sha256: MODEL_SHA256,
  mediapipe_version: MEDIAPIPE_VERSION,
  acquisition: `Landmarks measured ${source.acquired_at}; analytical profiles generated from the preserved measurements.`,
  landmarks: source.landmarks,
  analyses,
};
const output = path.join(
  root,
  "references/profiles/coach-reference-browser-30hz-v3.json",
);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(bundle));
console.log(`Generated ${output}`);
