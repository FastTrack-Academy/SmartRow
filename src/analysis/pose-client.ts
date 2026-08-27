import type { PoseRequest, PoseResponse } from "./worker-contract";
import { MODEL_SHA256 } from "./assets";

export function browserSupportError(): string | null {
  if (!window.isSecureContext || !crypto.subtle)
    return "Analysis requires HTTPS (or localhost). Netlify supplies HTTPS.";
  if (
    !window.Worker ||
    !window.WebAssembly ||
    !window.OffscreenCanvas ||
    !window.createImageBitmap
  ) {
    return "This browser lacks the video-analysis features required by this prototype. Try a current desktop Chrome or Edge browser.";
  }
  return null;
}

export class PoseClient {
  private worker = new Worker("/pose-worker.js");
  private rejectPending?: (error: Error) => void;
  constructor(private signal: AbortSignal) {
    signal.addEventListener("abort", this.close, { once: true });
  }
  close = () => {
    this.worker.terminate();
    this.signal.removeEventListener("abort", this.close);
    this.rejectPending?.(
      new DOMException(
        "Analysis cancelled. No score was produced.",
        "AbortError",
      ),
    );
  };

  private request(
    request: PoseRequest,
    transfer: Transferable[] = [],
  ): Promise<PoseResponse> {
    this.signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          fail(
            new Error(
              "Browser analysis timed out. Try a shorter clip on a desktop browser.",
            ),
          ),
        120_000,
      );
      const cleanup = () => {
        clearTimeout(timeout);
        this.rejectPending = undefined;
      };
      const fail = (error: Error) => {
        cleanup();
        reject(error);
      };
      this.rejectPending = fail;
      this.worker.onerror = (event) =>
        fail(
          new Error(
            `Pose worker failed: ${event.message || "browser or model not supported"}`,
          ),
        );
      this.worker.onmessageerror = () =>
        fail(new Error("Could not read the pose worker response."));
      this.worker.onmessage = (event: MessageEvent<PoseResponse>) => {
        if (event.data.type === "error") fail(new Error(event.data.message));
        else {
          cleanup();
          resolve(event.data);
        }
      };
      try {
        this.worker.postMessage(request, transfer);
      } catch (error) {
        fail(error as Error);
      }
    });
  }
  async initialize() {
    const response = await this.request({
      type: "initialize",
      modelHash: MODEL_SHA256,
    });
    if (response.type !== "ready")
      throw new Error("Unexpected model initialization response.");
  }
  async detect(bitmap: ImageBitmap, timestampMs: number) {
    const response = await this.request(
      { type: "frame", bitmap, timestampMs },
      [bitmap],
    );
    if (response.type !== "landmarks")
      throw new Error("Unexpected pose response.");
    return response.landmarks;
  }
}
