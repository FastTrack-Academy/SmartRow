/// <reference lib="webworker" />
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import type { PoseRequest, PoseResponse } from "./worker-contract";

// Compiled to a classic worker by prepare-assets.mjs. MediaPipe's WASM loader
// uses importScripts, which is unavailable in module workers.
const scope = self as unknown as DedicatedWorkerGlobalScope;
let detector: PoseLandmarker | undefined;
const respond = (response: PoseResponse) => scope.postMessage(response);

scope.onmessage = async (event: MessageEvent<PoseRequest>) => {
  const request = event.data;
  try {
    if (request.type === "initialize") {
      const moduleUrl = "/vendor/mediapipe/vision_bundle.mjs";
      const { FilesetResolver, PoseLandmarker } = (await import(
        moduleUrl
      )) as typeof import("@mediapipe/tasks-vision");
      const response = await fetch("/models/pose_landmarker_heavy.task");
      if (!response.ok)
        throw new Error(
          "Pose model unavailable. Rebuild the site and deploy the complete dist folder.",
        );
      const model = await response.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", model);
      const hash = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      if (hash !== request.modelHash)
        throw new Error(
          "Pose model integrity check failed. No analysis was performed.",
        );
      detector = await PoseLandmarker.createFromOptions(
        await FilesetResolver.forVisionTasks("/vendor/mediapipe/wasm"),
        {
          baseOptions: {
            modelAssetBuffer: new Uint8Array(model),
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputSegmentationMasks: false,
          canvas: new OffscreenCanvas(1, 1),
        },
      );
      respond({ type: "ready" });
    } else {
      try {
        if (!detector) throw new Error("Pose model is not initialized.");
        const result = detector.detectForVideo(
          request.bitmap,
          request.timestampMs,
        );
        respond({
          type: "landmarks",
          landmarks:
            result.landmarks[0]?.map((point) => ({
              x: point.x,
              y: point.y,
              z: point.z,
              visibility: point.visibility,
              // The web SDK does not expose presence; do not invent a confidence.
              presence: null,
            })) ?? null,
        });
      } finally {
        request.bitmap.close();
      }
    }
  } catch (error) {
    respond({
      type: "error",
      message:
        error instanceof Error
          ? error.message
          : "Browser pose estimation failed.",
    });
  }
};
