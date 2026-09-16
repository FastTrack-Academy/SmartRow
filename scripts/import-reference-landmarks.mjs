/**
 * One-time provenance-preserving import of browser-measured coach landmarks.
 * Usage: node scripts/import-reference-landmarks.mjs path/to/exported-report.json
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const input = process.argv[2];
if (!input) throw new Error("Pass the exported comparison report JSON path.");
const root = fileURLToPath(new URL("../", import.meta.url));
const report = JSON.parse(await readFile(path.resolve(input), "utf8"));
if (!report.reference?.video || !Array.isArray(report.reference?.landmarks))
  throw new Error("The report does not contain reference video landmarks.");
const output = path.join(
  root,
  "references/profiles/coach-reference-landmarks-web-v1.json",
);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(
  output,
  JSON.stringify({
    schema_version: "1.0",
    acquired_at: report.created_at,
    video: report.reference.video,
    landmarks: report.reference.landmarks,
    provenance: report.provenance,
    source_report_schema: report.schema_version,
    source_algorithm: report.algorithm_version,
  }),
);
console.log(`Imported ${report.reference.landmarks.length} sampled frames to ${output}`);
