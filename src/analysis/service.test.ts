import { beforeEach, expect, it, vi } from "vitest";
import {
  MODEL_SHA256,
  MEDIAPIPE_VERSION,
  KNOWN_FRONTAL_SHA256,
} from "./assets";

const referenceHash = "a".repeat(64);
const mocks = vi.hoisted(() => ({
  extract: vi.fn(),
  analyze: vi.fn(),
  compare: vi.fn(),
  hash: vi.fn(),
}));
vi.mock("./acquisition", () => ({ extractVideo: mocks.extract }));
vi.mock("./pose-client", () => ({ browserSupportError: () => null }));
vi.mock("./pipeline", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  analyzeLandmarks: mocks.analyze,
}));
vi.mock("./scoring", () => ({ compare: mocks.compare }));
vi.mock("./assets", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  sha256: mocks.hash,
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal("navigator", { userAgent: "synthetic test" });
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string) =>
        new Response(
          url.includes("manifest")
            ? JSON.stringify({
                reference_sha256: referenceHash,
                notebook_sha256: "b".repeat(64),
                model_sha256: MODEL_SHA256,
                mediapipe_version: MEDIAPIPE_VERSION,
              })
            : "synthetic reference bytes",
        ),
    ),
  );
  mocks.hash.mockImplementation(async (blob: Blob) =>
    blob instanceof File ? "c".repeat(64) : referenceHash,
  );
  mocks.extract.mockImplementation(
    async (_: Blob, name: string, sha256: string) => ({
      info: { name, sha256 },
      history: [],
    }),
  );
  mocks.analyze.mockReturnValue({ fixture: "synthetic analysis" });
  mocks.compare.mockReturnValue({ fixture: "synthetic report" });
});

it("fetches only static assets and processes candidates locally; reuses only the reference", async () => {
  const { analyzeVideo } = await import("./service");
  const file = new File(["synthetic"], "candidate.mp4");
  await analyzeVideo(
    file,
    "pixel",
    false,
    new AbortController().signal,
    vi.fn(),
  );
  await analyzeVideo(
    file,
    "notebook",
    true,
    new AbortController().signal,
    vi.fn(),
  );
  expect(mocks.extract).toHaveBeenCalledTimes(3); // reference once, candidate twice
  expect(mocks.extract.mock.calls[1][0]).toBe(file);
  for (const [url, options] of vi.mocked(fetch).mock.calls) {
    expect(["/asset-manifest.json", "/media/reference.mov"]).toContain(url);
    expect(options?.method).toBeUndefined();
    expect(options?.body).toBeUndefined();
  }
});

it("blocks the known frontal upload before fetching any assets", async () => {
  mocks.hash.mockResolvedValue(KNOWN_FRONTAL_SHA256);
  const { analyzeVideo } = await import("./service");
  await expect(
    analyzeVideo(
      new File(["x"], "renamed.mov"),
      "pixel",
      false,
      new AbortController().signal,
      vi.fn(),
    ),
  ).rejects.toThrow("front-facing");
  expect(fetch).not.toHaveBeenCalled();
  expect(mocks.extract).not.toHaveBeenCalled();
});

it("reuses measured reference landmarks only for identical content", async () => {
  mocks.hash.mockResolvedValue(referenceHash);
  const { analyzeVideo } = await import("./service");
  await analyzeVideo(
    new File(["x"], "reference.mov"),
    "pixel",
    false,
    new AbortController().signal,
    vi.fn(),
  );
  expect(mocks.extract).toHaveBeenCalledTimes(1);
});

it("abort prevents extraction and releases the run guard for retry", async () => {
  const { analyzeVideo } = await import("./service");
  const controller = new AbortController();
  controller.abort();
  const file = new File(["x"], "candidate.mp4");
  await expect(
    analyzeVideo(file, "pixel", false, controller.signal, vi.fn()),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(mocks.extract).not.toHaveBeenCalled();
  await expect(
    analyzeVideo(file, "pixel", false, new AbortController().signal, vi.fn()),
  ).resolves.toBeDefined();
});

it("does not return a score for candidate decoding failure", async () => {
  mocks.extract.mockImplementation(
    async (_: Blob, name: string, sha256: string) => {
      if (name !== "Video.mov") throw new Error("codec failure");
      return { info: { name, sha256 }, history: [] };
    },
  );
  const { analyzeVideo } = await import("./service");
  await expect(
    analyzeVideo(
      new File(["x"], "broken.mp4"),
      "pixel",
      false,
      new AbortController().signal,
      vi.fn(),
    ),
  ).rejects.toThrow("codec failure");
  expect(mocks.compare).not.toHaveBeenCalled();
});

it("rejects mismatched static model assets", async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response(JSON.stringify({ model_sha256: "wrong" })),
  );
  const { analyzeVideo } = await import("./service");
  await expect(
    analyzeVideo(
      new File(["x"], "candidate.mp4"),
      "pixel",
      false,
      new AbortController().signal,
      vi.fn(),
    ),
  ).rejects.toThrow("versions");
  expect(mocks.extract).not.toHaveBeenCalled();
});
