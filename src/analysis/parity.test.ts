import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/python-parity.json";
import {
  angle,
  findPeaks,
  gaussian,
  interpolate,
  resample,
  trunkLean,
  type Point,
} from "./math";
import { extractFeatures, selectSide, type Side } from "./features";
import {
  analyzeLandmarks,
  DEFAULT_CONFIG,
  detectStrokes,
  preprocess,
  standardize,
} from "./pipeline";
import { applyWeights, compare } from "./scoring";
import { assertSuitableHash, KNOWN_FRONTAL_SHA256 } from "./assets";
import { samplingMetadata } from "./acquisition";
import type { VideoAnalysis, VideoInfo } from "../contracts";

// Absolute tolerance for Float64 mathematical ports, not model/measurement accuracy.
function close(actual: unknown, expected: unknown): void {
  if (typeof expected === "number")
    expect(Math.abs((actual as number) - expected)).toBeLessThanOrEqual(1e-9);
  else if (Array.isArray(expected)) {
    expect(actual).toHaveLength(expected.length);
    expected.forEach((value, i) => close((actual as unknown[])[i], value));
  } else expect(actual).toEqual(expected);
}
const info: VideoInfo = {
  name: "synthetic",
  width: 568,
  height: 320,
  fps: 30,
  frame_count: 600,
  duration_s: 20,
  sha256: "synthetic",
};

describe("Python mathematical parity (synthetic; not scientific validation)", () => {
  it("matches original angles and signed trunk lean", () => {
    for (const row of fixture.angles) {
      const [a, b, c] = row.points.map(
        (point) => [point[0], point[1]] as Point,
      );
      close(angle(a, b, c), row.angle);
      close(trunkLean(a, b), row.trunk);
    }
    expect(angle([0, 0], [0, 0], [1, 0])).toBeNaN();
    close(angle([1, 0], [0, 0], [0, 1]), 90);
  });
  it("matches both sides, coordinate modes and mirroring", () => {
    for (const row of fixture.features) {
      const result = extractFeatures(
        fixture.landmarks,
        row.side as Side,
        { ...info, width: row.width, height: row.height },
        {
          ...DEFAULT_CONFIG,
          coordinate_mode: row.width === 1 ? "notebook" : "pixel",
        },
        row.mirror,
      );
      close(result.raw.slice(0, 4), row.expected);
      expect(result.raw.slice(4)).toHaveLength(2);
    }
    expect(selectSide([fixture.landmarks])).toBe("left");
    expect(
      extractFeatures(null, "left", info, DEFAULT_CONFIG, false).raw,
    ).toEqual([null, null, null, null, null, null]);
    expect(
      extractFeatures(
        fixture.landmarks.map((l) => ({ ...l, visibility: 0.1 })),
        "left",
        info,
        DEFAULT_CONFIG,
        false,
      ).raw,
    ).toEqual([null, null, null, null, null, null]);
  });
  it("keeps neck and wrist proxies mirror-invariant and gates them independently", () => {
    const original = extractFeatures(
      fixture.landmarks,
      "left",
      info,
      DEFAULT_CONFIG,
      false,
    );
    const mirrored = extractFeatures(
      fixture.landmarks,
      "left",
      info,
      DEFAULT_CONFIG,
      true,
    );
    close(mirrored.raw.slice(4), original.raw.slice(4));
    const lowEar = fixture.landmarks.map((landmark, index) => ({
      ...landmark,
      visibility: index === 7 ? 0 : landmark.visibility,
    }));
    const gated = extractFeatures(lowEar, "left", info, DEFAULT_CONFIG, false);
    expect(gated.raw[4]).toBeNull();
    expect(gated.raw.slice(0, 4).every((value) => value !== null)).toBe(true);
  });
  it("matches pandas bidirectional interpolation including rejected edge and long gaps", () => {
    for (const row of fixture.interpolations) {
      close(
        interpolate(
          row.input.map((v) => v ?? NaN),
          5,
        ).map((v) => (Number.isFinite(v) ? v : null)),
        row.expected,
      );
    }
    expect(() =>
      preprocess(
        Array.from({ length: 30 }, () => [null, null, null, null]),
        DEFAULT_CONFIG,
      ),
    ).toThrow("gaps");
  });
  it("matches SciPy Gaussian reflect boundaries even on very short arrays", () => {
    for (const row of fixture.filters)
      close(gaussian(row.input, 2), row.expected);
  });
  it("matches SciPy local maxima, plateaus, distance and prominence fixtures", () => {
    for (const row of fixture.peaks)
      expect(findPeaks(row.input, row.distance, row.prominence)).toEqual(
        row.expected,
      );
  });
  it("matches preprocessing, exact catch/finish indices and 100-point fingerprints", () => {
    const { processed, smooth } = preprocess(
      fixture.pipeline.raw,
      DEFAULT_CONFIG,
    );
    close(processed, fixture.pipeline.processed);
    close(smooth, fixture.pipeline.smooth);
    const { catches, strokes } = detectStrokes(smooth, 30, DEFAULT_CONFIG);
    expect(catches).toEqual(fixture.pipeline.catches);
    expect(strokes).toEqual(fixture.pipeline.strokes);
    close(
      strokes.map((stroke) => standardize(smooth, stroke, DEFAULT_CONFIG)),
      fixture.pipeline.fingerprints,
    );
    close(
      standardize(smooth, strokes[0], DEFAULT_CONFIG)[39],
      smooth[strokes[0].finish_frame],
    );
  });
  it("matches all-stroke, per-feature, phase and aggregate distances", () => {
    const analysis = {
      video: info,
      fingerprints: fixture.pipeline.fingerprints.map((stroke) =>
        stroke.map((row) => [...row, 0, 0]),
      ),
      mean: fixture.pipeline.mean.map((row) => [...row, 0, 0]),
    } as VideoAnalysis;
    const report = compare(analysis, analysis, DEFAULT_CONFIG, {
      fixture: "synthetic",
    });
    close(
      report.features.slice(0, 4).map((f) => f.rmse_degrees),
      fixture.pipeline.feature_rmse,
    );
    close(
      report.features.slice(0, 4).map((f) => f.drive_rmse_degrees),
      fixture.pipeline.drive_rmse,
    );
    close(
      report.features.slice(0, 4).map((f) => f.recovery_rmse_degrees),
      fixture.pipeline.recovery_rmse,
    );
    expect(report.evidence_status).toContain("Self-comparison");
  });
});

describe("failure guards and invariants", () => {
  it("does not average away candidate variation before scoring", () => {
    const zeros = Array.from({ length: 100 }, () => [0, 0, 0, 0, 0, 0]);
    const reference = {
      video: info,
      fingerprints: [zeros],
      mean: zeros,
    } as VideoAnalysis;
    const candidate = {
      ...reference,
      fingerprints: [
        zeros.map((r) => r.map(() => 10)),
        zeros.map((r) => r.map(() => -10)),
      ],
    };
    expect(
      compare(reference, candidate, DEFAULT_CONFIG, {}).overall_rmse_degrees,
    ).toBe(10);
  });
  it("reports per-stroke stability, curve area and editable weighted scoring", () => {
    const zeros = Array.from({ length: 100 }, () => [0, 0, 0, 0, 0, 0]);
    const reference = {
      video: info,
      fingerprints: [zeros],
      mean: zeros,
    } as VideoAnalysis;
    const candidate = {
      ...reference,
      video: { ...info, sha256: "candidate" },
      fingerprints: [
        zeros.map((row) => row.map(() => 10)),
        zeros.map((row) => row.map(() => 20)),
      ],
    };
    const report = compare(reference, candidate, DEFAULT_CONFIG, {});
    expect(report.stroke_score_mean_degrees).toBeCloseTo(15);
    expect(report.stroke_score_std_degrees).toBeCloseTo(5);
    expect(report.features[0].absolute_curve_area_degree_cycle).toBeCloseTo(15);
    expect(report.features[0].stroke_area_std_degree_cycle).toBeCloseTo(5);
    expect(Object.values(report.weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
  it("normalizes edited weights and changes only the weighted aggregate", () => {
    const zeros = Array.from({ length: 100 }, () => [0, 0, 0, 0, 0, 0]);
    const reference = {
      video: info,
      fingerprints: [zeros],
      mean: zeros,
    } as VideoAnalysis;
    const candidate = {
      ...reference,
      video: { ...info, sha256: "candidate" },
      fingerprints: [zeros.map(() => [10, 0, 0, 0, 0, 0])],
    };
    const report = compare(reference, candidate, DEFAULT_CONFIG, {});
    const kneeOnly = applyWeights(report, {
      knee_angle: 7,
      hip_angle: 0,
      elbow_angle: 0,
      trunk_lean: 0,
      neck_proxy: 0,
      wrist_proxy: 0,
    });
    expect(kneeOnly.weighted_rmse_degrees).toBe(10);
    expect(kneeOnly.weights.knee_angle).toBe(1);
    expect(kneeOnly.features[0].rmse_degrees).toBe(report.features[0].rmse_degrees);
    expect(kneeOnly.feedback[0]).toContain("knee");
  });
  it("rejects missing poses and constant signals without complete strokes", () => {
    expect(() => analyzeLandmarks([null, null], info, DEFAULT_CONFIG)).toThrow(
      "No person",
    );
    expect(() =>
      detectStrokes(
        Array.from({ length: 100 }, () => [90, 90, 90, 0]),
        30,
        DEFAULT_CONFIG,
      ),
    ).toThrow("No complete");
  });
  it("preserves resampling endpoints", () => {
    const result = resample([3, 8, 6], 100);
    expect(result[0]).toBe(3);
    expect(result[99]).toBe(6);
    expect(() => resample([3], 100)).toThrow();
  });
  it("rejects the frontal input by content identity, not filename", () => {
    expect(() => assertSuitableHash(KNOWN_FRONTAL_SHA256)).toThrow(
      "front-facing",
    );
    expect(() => assertSuitableHash("other")).not.toThrow();
  });
  it("labels the sampling grid explicitly and bounds resources", () => {
    const metadata = samplingMetadata("test", 568, 320, 16.75, "hash");
    expect(metadata.fps).toBe(30);
    expect(metadata.frame_count).toBe(503);
    expect(metadata.sampling_method).toBe("browser-seek-30hz");
    for (const duration of [NaN, Infinity, -1, 0, 121])
      expect(() => samplingMetadata("bad", 568, 320, duration, "")).toThrow();
    expect(() => samplingMetadata("bad", 8000, 4000, 20, "")).toThrow("4K");
  });
});
