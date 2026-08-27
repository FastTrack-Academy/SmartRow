import { describe, expect, it } from "vitest";
import { signalsCsv, validateVideo } from "./files";
import type { VideoAnalysis } from "./contracts";

describe("video selection", () => {
  it("accepts supported video names case-insensitively", () =>
    expect(validateVideo({ name: "ROW.MOV", size: 42 })).toBeNull());
  it("rejects unsupported and empty files", () => {
    expect(validateVideo({ name: "notes.txt", size: 42 })).toContain("Choose");
    expect(validateVideo({ name: "clip.mp4", size: 0 })).toContain("empty");
  });
  it("enforces an engineering upload limit", () =>
    expect(
      validateVideo({ name: "clip.mp4", size: 100 * 1024 * 1024 + 1 }),
    ).toContain("100 MiB"));
});
it("exports raw missing measurements as blanks, never zero", () => {
  const fixture = {
    signals: [
      {
        frame: 0,
        time_s: 0,
        quality: 0.4,
        raw: [null, 90, 90, 0],
        processed: [50, 90, 90, 0],
        smooth: [51, 90, 90, 0],
      },
    ],
  } as VideoAnalysis;
  const csv = signalsCsv(fixture);
  expect(csv).toContain("raw_knee_degrees");
  expect(csv.split("\n")[1]).toBe("0,0,0.4,,90,90,0,50,90,90,0,51,90,90,0");
});
