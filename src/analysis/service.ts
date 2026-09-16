import type {
  AnalysisProgress,
  CoordinateMode,
  ReferenceProfileBundle,
  VideoAnalysis,
} from "../contracts";
import { extractVideo } from "./acquisition";
import {
  assertSuitableHash,
  MEDIAPIPE_VERSION,
  MODEL_SHA256,
  REFERENCE_PROFILE_URL,
  sha256,
  type AssetManifest,
} from "./assets";
import { analyzeLandmarks, DEFAULT_CONFIG } from "./pipeline";
import { browserSupportError } from "./pose-client";
import { compare } from "./scoring";

// The deployable coach profile is precomputed. No candidate or result persistence.
let cachedProfile:
  | { sha256: string; bundle: ReferenceProfileBundle }
  | undefined;
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
      manifest.reference_profile_schema !== "1.0" ||
      !/^[a-f0-9]{64}$/.test(manifest.reference_sha256) ||
      !/^[a-f0-9]{64}$/.test(manifest.reference_profile_sha256)
    ) {
      throw new Error(
        "Static asset versions do not match this application. Rebuild and redeploy.",
      );
    }
    if (cachedProfile?.sha256 !== manifest.reference_profile_sha256)
      cachedProfile = undefined;
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
    if (!cachedProfile) {
      progress({
        stage: "loading",
        message: "Loading the precomputed coach profile…",
      });
      const response = await fetch(REFERENCE_PROFILE_URL, { signal });
      if (!response.ok)
        throw new Error("Precomputed coach profile is missing from this deployment.");
      const profileBlob = await response.blob();
      if ((await sha256(profileBlob)) !== manifest.reference_profile_sha256)
        throw new Error("Coach profile integrity check failed.");
      const bundle = JSON.parse(await profileBlob.text()) as ReferenceProfileBundle;
      if (
        bundle.reference_profile_schema !== "1.0" ||
        bundle.algorithm_version !== "lecture5-browser-30hz-v3" ||
        bundle.reference_sha256 !== manifest.reference_sha256 ||
        bundle.model_sha256 !== MODEL_SHA256 ||
        bundle.mediapipe_version !== MEDIAPIPE_VERSION ||
        !bundle.analyses?.pixel ||
        !bundle.analyses?.notebook
      )
        throw new Error("Precomputed coach profile is incompatible with this application.");
      cachedProfile = { sha256: manifest.reference_profile_sha256, bundle };
    }
    signal.throwIfAborted();
    const reference: VideoAnalysis = {
      ...cachedProfile.bundle.analyses[mode],
      landmarks: cachedProfile.bundle.landmarks,
    };
    const extracted =
      candidateHash === reference.video.sha256
        ? {
            history: cachedProfile.bundle.landmarks,
            info: { ...reference.video, name: file.name },
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
      reference_profile:
        "Precomputed v1 bundle; fixed measured coach landmarks are not re-inferred per browser session",
    });
  } finally {
    busy = false;
  }
}
