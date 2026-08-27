import type { VideoAnalysis } from "./contracts";

export function validateVideo(
  file: Pick<File, "name" | "size">,
): string | null {
  if (!/\.(mp4|mov|m4v|webm)$/i.test(file.name))
    return "Choose an MP4, MOV, M4V or WebM video.";
  if (file.size === 0)
    return "This file is empty. Please choose another video.";
  if (file.size > 100 * 1024 * 1024)
    return "The demo upload limit is 100 MiB. Please trim your video.";
  return null;
}

export function downloadFile(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function signalsCsv(analysis: VideoAnalysis): string {
  const names = ["knee", "hip", "elbow", "trunk"];
  const header = [
    "frame",
    "time_s",
    "visibility",
    ...["raw", "processed", "smooth"].flatMap((stage) =>
      names.map((name) => `${stage}_${name}_degrees`),
    ),
  ];
  return [
    header.join(","),
    ...analysis.signals.map((row) =>
      [
        row.frame,
        row.time_s,
        row.quality,
        ...row.raw,
        ...row.processed,
        ...row.smooth,
      ].join(","),
    ),
  ].join("\n");
}
