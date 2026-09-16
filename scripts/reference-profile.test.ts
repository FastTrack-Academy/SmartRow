import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { Landmark, ReferenceProfileBundle, VideoInfo } from "../src/contracts";
import { FEATURE_DEFINITIONS } from "../src/contracts";
import { analyzeLandmarks, DEFAULT_CONFIG } from "../src/analysis/pipeline";

const root = new URL("../", import.meta.url);

describe("versioned coach profile", () => {
  it("matches a fresh analysis of the preserved measured landmarks", async () => {
    const source = JSON.parse(
      await readFile(
        new URL("references/profiles/coach-reference-landmarks-web-v1.json", root),
        "utf8",
      ),
    ) as { video: VideoInfo; landmarks: (Landmark[] | null)[] };
    const profile = JSON.parse(
      await readFile(
        new URL("references/profiles/coach-reference-browser-30hz-v3.json", root),
        "utf8",
      ),
    ) as ReferenceProfileBundle;

    expect(profile.reference_profile_schema).toBe("1.0");
    expect(profile.algorithm_version).toBe("lecture5-browser-30hz-v3");
    expect(profile.reference_sha256).toBe(source.video.sha256);
    expect(profile.landmarks).toHaveLength(source.video.frame_count);
    for (const coordinate_mode of ["pixel", "notebook"] as const) {
      const fresh = analyzeLandmarks(source.landmarks, source.video, {
        ...DEFAULT_CONFIG,
        coordinate_mode,
      });
      expect(profile.analyses[coordinate_mode].catches).toEqual(fresh.catches);
      expect(profile.analyses[coordinate_mode].strokes).toEqual(fresh.strokes);
      expect(profile.analyses[coordinate_mode].mean).toEqual(fresh.mean);
      expect(profile.analyses[coordinate_mode].mean[0]).toHaveLength(
        FEATURE_DEFINITIONS.length,
      );
    }
  });
});
