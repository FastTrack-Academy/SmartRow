import type { AnalysisProgress, CoordinateMode } from "../contracts";
import { extractVideo } from "./acquisition";
import {
  assertSuitableHash,
  MEDIAPIPE_VERSION,
  MODEL_SHA256,
  REFERENCE_URL,
  sha256,
  type AssetManifest,
} from "./assets";
import { analyzeLandmarks, DEFAULT_CONFIG } from "./pipeline";
import { browserSupportError } from "./pose-client";
import { compare } from "./scoring";

// One reference only, in memory. No candidate or result persistence.
let cachedReference: Awaited<ReturnType<typeof extractVideo>> | undefined;
let busy = false;

export async function analyzeVideo(
  file: File,
  mode: CoordinateMode,
  mirror: boolean,
  signal: AbortSignal,
  progress: (value: AnalysisProgress) => void,
) {
  if (busy) throw new Error("An analysis is already running in this page.");
  const unsupported = browserSupportError();
  if (unsupported) throw new Error(unsupported);
  busy = true;
  try {
    signal.throwIfAborted();
    progress({
      stage: "loading",
      message: "Checking the selected file and static analysis assets…",
    });
    const candidateHash = await sha256(file);
    signal.throwIfAborted();
    assertSuitableHash(candidateHash);
    const manifestResponse = await fetch("/asset-manifest.json", {
      signal,
      cache: "no-cache",
    });
    if (!manifestResponse.ok)
      throw new Error(
        "Static analysis assets are missing. Run npm run build and deploy the complete dist folder.",
      );
    const manifest: AssetManifest = await manifestResponse.json();
    if (
      manifest.model_sha256 !== MODEL_SHA256 ||
      manifest.mediapipe_version !== MEDIAPIPE_VERSION ||
      !/^[a-f0-9]{64}$/.test(manifest.reference_sha256)
    ) {
      throw new Error(
        "Static asset versions do not match this application. Rebuild and redeploy.",
      );
    }
    if (cachedReference?.info.sha256 !== manifest.reference_sha256)
      cachedReference = undefined;
    const reportProgress =
      (stage: "reference" | "candidate") =>
      (completed: number, total: number) =>
        progress({
          stage,
          completed,
          total,
          message:
            completed === 0
              ? `Loading the pose model for the ${stage}…`
              : `Processing ${stage}: ${completed} / ${total} sampled frames`,
        });
    if (!cachedReference) {
      progress({
        stage: "loading",
        message: "Loading the coach reference from this site…",
      });
      const response = await fetch(REFERENCE_URL, { signal });
      if (!response.ok)
        throw new Error("Coach reference is missing from this deployment.");
      const referenceBlob = await response.blob();
      if ((await sha256(referenceBlob)) !== manifest.reference_sha256)
        throw new Error("Coach reference integrity check failed.");
      cachedReference = await extractVideo(
        referenceBlob,
        "Video.mov",
        manifest.reference_sha256,
        signal,
        reportProgress("reference"),
      );
    }
    signal.throwIfAborted();
    const extracted =
      candidateHash === cachedReference.info.sha256
        ? {
            ...cachedReference,
            info: { ...cachedReference.info, name: file.name },
          }
        : await extractVideo(
            file,
            file.name,
            candidateHash,
            signal,
            reportProgress("candidate"),
          );
    signal.throwIfAborted();
    progress({
      stage: "comparing",
      message:
        "Calculating angles, finding complete strokes and comparing curves…",
    });
    const config = {
      ...DEFAULT_CONFIG,
      coordinate_mode: mode,
      mirror_candidate: mirror,
    };
    const reference = analyzeLandmarks(
      cachedReference.history,
      cachedReference.info,
      config,
    );
    const candidate = analyzeLandmarks(
      extracted.history,
      extracted.info,
      config,
      mirror,
    );
    return compare(reference, candidate, config, {
      runtime: "Browser-only; MediaPipe WebAssembly CPU in a dedicated worker",
      mediapipe: MEDIAPIPE_VERSION,
      model_sha256: MODEL_SHA256,
      notebook_sha256: manifest.notebook_sha256,
      browser: navigator.userAgent,
      sampling:
        "Browser seek grid at 30 Hz; frame indices are sampled observations, not native encoded frame numbers",
      presence: "Not exposed by web SDK; exported as null",
      peak_ties: "Equal-height distance conflicts prefer the later sample",
    });
  } finally {
    busy = false;
  }
}
