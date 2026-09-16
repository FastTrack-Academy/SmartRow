/** Node-only static build preparation. Never runs on the deployed site. */
import { mkdir, readFile, writeFile, copyFile, cp } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "public");
const hash = (data) => createHash("sha256").update(data).digest("hex");
const modelHash =
  "64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b";
const modelUrl =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task";
for (const directory of ["models", "media", "vendor/mediapipe"])
  await mkdir(path.join(output, directory), { recursive: true });

const modelPath = path.join(output, "models/pose_landmarker_heavy.task");
let model;
for (const candidate of [
  modelPath,
  path.join(
    root,
    "references/python/backend/models/pose_landmarker_heavy.task",
  ),
]) {
  try {
    const bytes = await readFile(candidate);
    if (hash(bytes) === modelHash) {
      model = bytes;
      break;
    }
  } catch {
    /* not cached */
  }
}
if (!model) {
  console.log(
    "Downloading the pinned MediaPipe Heavy model for static hosting…",
  );
  const response = await fetch(modelUrl, {
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok)
    throw new Error(
      `Model download failed (${response.status}). Retry the build.`,
    );
  model = Buffer.from(await response.arrayBuffer());
}
if (hash(model) !== modelHash)
  throw new Error("Model SHA-256 mismatch; refusing to build.");
await writeFile(modelPath, model);

const media = [
  ["source/standard video/Video.mov", "media/reference.mov"],
  ["source/candidate video/Video_1.mov", "media/candidate.mov"],
];
for (const [source, destination] of media)
  await copyFile(path.join(root, source), path.join(output, destination));
const profileSource = path.join(
  root,
  "references/profiles/coach-reference-browser-30hz-v3.json",
);
const profileDestination = path.join(output, "reference-profile.json");
await copyFile(profileSource, profileDestination);
const packageRoot = path.join(root, "node_modules/@mediapipe/tasks-vision");
await cp(
  path.join(packageRoot, "wasm"),
  path.join(output, "vendor/mediapipe/wasm"),
  { recursive: true },
);
await copyFile(
  path.join(packageRoot, "vision_bundle.mjs"),
  path.join(output, "vendor/mediapipe/vision_bundle.mjs"),
);
const worker = await readFile(
  path.join(root, "src/analysis/pose.worker.ts"),
  "utf8",
);
const compiled = ts.transpileModule(worker, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
});
// Type-only imports are erased; the worker uses dynamic import for MediaPipe.
await writeFile(
  path.join(output, "pose-worker.js"),
  compiled.outputText.replace(/^export \{\};?\s*$/gm, ""),
);
const packageInfo = JSON.parse(
  await readFile(path.join(packageRoot, "package.json"), "utf8"),
);
await writeFile(
  path.join(output, "asset-manifest.json"),
  JSON.stringify(
    {
      reference_sha256: hash(await readFile(path.join(root, media[0][0]))),
      reference_profile_sha256: hash(await readFile(profileSource)),
      reference_profile_schema: "1.0",
      notebook_sha256: hash(
        await readFile(
          path.join(
            root,
            "source/Hagan_Lecture_5_Motion_and_Standardized_Stroke (1).ipynb",
          ),
        ),
      ),
      model_sha256: modelHash,
      mediapipe_version: packageInfo.version,
    },
    null,
    2,
  ),
);
console.log(
  "Static videos, precomputed coach profile, verified model, WASM runtime and pose worker are ready.",
);
