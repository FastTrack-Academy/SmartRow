export const MODEL_SHA256 =
  "64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b";
export const KNOWN_FRONTAL_SHA256 =
  "6d37f5c3497028f0266ff50b9dc97b4e5315f7876b9a5cad1cf9e34922b99b46";
export const REFERENCE_URL = "/media/reference.mov";
export const CANDIDATE_URL = "/media/candidate.mov";
export const SAMPLE_FPS = 30;
export const MEDIAPIPE_VERSION = "0.10.21";

export interface AssetManifest {
  reference_sha256: string;
  notebook_sha256: string;
  model_sha256: string;
  mediapipe_version: string;
}

export async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await blob.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function assertSuitableHash(hash: string) {
  if (hash === KNOWN_FRONTAL_SHA256)
    throw new Error(
      "The supplied candidate is front-facing, including this renamed copy. Choose a different fixed side-view recording; no score was produced.",
    );
}
