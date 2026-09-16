import { useMemo, useState } from "react";
import type { ComparisonReport, FeatureWeights } from "../contracts";
import { FEATURE_LABELS } from "../contracts";
import { applyWeights, DEFAULT_WEIGHTS } from "../analysis/scoring";
import { downloadFile, signalsCsv } from "../files";
import { SignalChart } from "./SignalChart";
import { Icon } from "./Icon";

export function Results({
  report: baseReport,
  onSeek,
}: {
  report: ComparisonReport | null;
  onSeek: (frame: number) => void;
}) {
  const [feature, setFeature] = useState(0);
  const [stroke, setStroke] = useState(-1);
  const [inspectRole, setInspectRole] = useState<"reference" | "candidate">(
    "candidate",
  );
  const [stage, setStage] = useState<"raw" | "processed" | "smooth">("smooth");
  const [weights, setWeights] = useState<FeatureWeights>(
    baseReport?.weights ?? DEFAULT_WEIGHTS,
  );
  const weightTotal = Object.values(weights).reduce(
    (sum, value) => sum + value,
    0,
  );
  const report = useMemo(
    () =>
      baseReport && weightTotal > 0
        ? applyWeights(baseReport, weights)
        : baseReport,
    [baseReport, weights, weightTotal],
  );
  const selected = report
    ? stroke >= 0
      ? report.candidate.fingerprints[stroke]
      : report.candidate.mean
    : null;
  const inspected = report?.[inspectRole];
  return (
    <section className="results" aria-labelledby="results-title">
      <div className="section-heading">
        <h2 id="results-title">A clear view of your movement</h2>
        {report ? (
          <button
            className="button secondary small"
            disabled={weightTotal <= 0}
            onClick={() =>
              downloadFile(
                JSON.stringify(report, null, 2),
                "smartrow-report.json",
                "application/json",
              )
            }
          >
            <Icon name="download" size={16} /> Export report
          </button>
        ) : null}
      </div>
      <div className="feature-tabs" aria-label="Angle to inspect">
        {FEATURE_LABELS.map((label, index) => (
          <button
            key={label}
            aria-pressed={feature === index}
            className={feature === index ? "active" : ""}
            onClick={() => setFeature(index)}
          >
            {label}
          </button>
        ))}
      </div>
      {!report ? (
        <div className="empty-results">
          <Icon name="chart" size={34} />
          <h3>Your comparison will appear here</h3>
          <p>
            Angles, stroke timing, and differences — linked back to the video.
          </p>
        </div>
      ) : (
        <>
          <p className="evidence-note">{report.evidence_status}</p>
          <div className="score-summary">
            <div>
              <span className="metric-label">Weighted motion difference</span>
              <div className="score">
                {weightTotal > 0
                  ? report.weighted_rmse_degrees.toFixed(1)
                  : "—"}
                <span>° RMSE</span>
              </div>
            </div>
            <p>
              Lower means more similar to this reference.
              <br />
              <strong>Not a technique grade or an injury-risk score.</strong>
            </p>
            <div className="metric-detail">
              <strong>
                {weightTotal > 0
                  ? `${report.stroke_score_mean_degrees.toFixed(1)} ± ${report.stroke_score_std_degrees.toFixed(1)}°`
                  : "—"}
              </strong>
              <span>
                stroke mean ± population SD across {report.candidate.strokes.length}{" "}
                complete strokes
              </span>
            </div>
          </div>
          <div className="result-toolbar">
            <div>
              <h3>{FEATURE_LABELS[feature]} angle comparison</h3>
              <p>Finish at point 39 · 40 drive + 60 recovery points</p>
            </div>
            <label>
              Candidate curve
              <select
                value={stroke}
                onChange={(event) => setStroke(Number(event.target.value))}
              >
                <option value={-1}>Mean of all strokes</option>
                {report.candidate.strokes.map((item, index) => (
                  <option key={item.id} value={index}>
                    Stroke {item.id}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <SignalChart
            title={`${FEATURE_LABELS[feature]} angle: candidate and reference`}
            xLabel="Standardized stroke point (not elapsed time)"
            xMax={99}
            series={[
              {
                name: "Coach reference mean",
                values: report.reference.mean.map((row) => row[feature]),
                color: "#147d80",
              },
              {
                name:
                  stroke < 0
                    ? "Candidate mean"
                    : `Candidate stroke ${stroke + 1}`,
                values: selected!.map((row) => row[feature]),
                color: "#ce7d45",
              },
            ]}
            lower={report.reference.mean.map(
              (row, i) => row[feature] - report.reference.std[i][feature],
            )}
            upper={report.reference.mean.map(
              (row, i) => row[feature] + report.reference.std[i][feature],
            )}
            markers={[{ index: 39, label: "Finish" }]}
          />
          <p className="caption">
            The band is between-stroke variability, not a confidence interval.
            Scores compare every candidate stroke with the reference mean, so
            the mean curve can hide variation.
          </p>
          <div className="table-wrap">
            <table>
              <caption>
                Difference by feature · all candidate strokes against the coach
                reference mean
              </caption>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Weight input</th>
                  <th>RMSE</th>
                  <th>Stroke RMSE mean ± SD</th>
                  <th>Absolute curve area mean ± SD</th>
                  <th>Drive RMSE</th>
                  <th>Recovery RMSE</th>
                </tr>
              </thead>
              <tbody>
                {report.features.map((item) => (
                  <tr key={item.feature}>
                    <th>{item.label}</th>
                    <td>
                      <label className="weight-input">
                        <span className="sr-only">
                          {item.label} weight percent
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={Number((weights[item.feature] * 100).toFixed(2))}
                          onChange={(event) =>
                            setWeights((current) => ({
                              ...current,
                              [item.feature]:
                                Math.max(
                                  0,
                                  Number(event.target.value) || 0,
                                ) / 100,
                            }))
                          }
                        />
                        <span>%</span>
                      </label>
                    </td>
                    <td>{item.rmse_degrees.toFixed(2)}°</td>
                    <td>
                      {item.stroke_rmse_mean_degrees.toFixed(2)} ±{" "}
                      {item.stroke_rmse_std_degrees.toFixed(2)}°
                    </td>
                    <td>
                      {item.absolute_curve_area_degree_cycle.toFixed(2)} ±{" "}
                      {item.stroke_area_std_degree_cycle.toFixed(2)} °·cycle
                    </td>
                    <td>{item.drive_rmse_degrees.toFixed(2)}°</td>
                    <td>{item.recovery_rmse_degrees.toFixed(2)}°</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="weight-note">
            <p>
              Editable project weights · entered total{" "}
              {(weightTotal * 100).toFixed(1)}%. Values are normalized to 100%
              when calculating the score. Default rank-sum order: trunk → elbow
              → neck → wrist → knee → hip.
            </p>
            <button
              className="text-button"
              onClick={() => setWeights(DEFAULT_WEIGHTS)}
            >
              Reset default weights
            </button>
          </div>
          {weightTotal <= 0 ? (
            <p className="inline-warning">Set at least one weight above zero.</p>
          ) : null}
          <div className="review-notes">
            <h3>What to review with your coach</h3>
            <ol>
              {report.feedback.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ol>
          </div>
          <details className="inspector" open>
            <summary>
              Inspect the analysis · raw angles to complete strokes
            </summary>
            <div className="result-toolbar">
              <label>
                Video
                <select
                  value={inspectRole}
                  onChange={(event) =>
                    setInspectRole(
                      event.target.value as "reference" | "candidate",
                    )
                  }
                >
                  <option value="candidate">Candidate</option>
                  <option value="reference">Coach reference</option>
                </select>
              </label>
              <label>
                Signal stage
                <select
                  value={stage}
                  onChange={(event) =>
                    setStage(event.target.value as typeof stage)
                  }
                >
                  <option value="raw">Raw measurements</option>
                  <option value="processed">Gap-interpolated</option>
                  <option value="smooth">Gaussian-smoothed</option>
                </select>
              </label>
              <button
                className="text-button"
                onClick={() =>
                  downloadFile(
                    signalsCsv(inspected!),
                    `smartrow-${inspectRole}-signals.csv`,
                    "text/csv",
                  )
                }
              >
                Download signals CSV
              </button>
            </div>
            <div className="quality-line">
              <span>
                Pose detected:{" "}
                <strong>
                  {(inspected!.detection_coverage * 100).toFixed(1)}%
                </strong>
              </span>
              <span>
                Measured angles:{" "}
                <strong>
                  {(inspected!.measured_coverage * 100).toFixed(1)}%
                </strong>
              </span>
              <span>
                Tracked side: <strong>{inspected!.active_side}</strong>
              </span>
              <span>
                Complete strokes: <strong>{inspected!.strokes.length}</strong>
              </span>
            </div>
            <p className="caption">
              Detection coverage is not accuracy. Missing raw measurements
              remain visible as gaps.
            </p>
            <SignalChart
              title={`${inspectRole} ${FEATURE_LABELS[feature]} ${stage} signal`}
              xLabel="Time (seconds)"
              xMax={inspected!.signals.at(-1)!.time_s}
              series={[
                {
                  name: `${FEATURE_LABELS[feature]} · ${stage}`,
                  values: inspected!.signals.map((row) => row[stage][feature]),
                  color: "#147d80",
                },
              ]}
              markers={inspected!.catches.map((index) => ({
                index,
                label: "Catch",
              }))}
            />
            <div className="table-wrap">
              <table>
                <caption>
                  {inspectRole === "candidate" ? "Candidate" : "Reference"}{" "}
                  stroke timing · first and last partial strokes are excluded
                </caption>
                <thead>
                  <tr>
                    <th>Stroke</th>
                    <th>Cycle</th>
                    <th>Drive</th>
                    <th>Recovery</th>
                    <th>Strokes/min</th>
                    {inspectRole === "candidate" ? <th>Review</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {inspected!.strokes.map((item) => (
                    <tr key={item.id}>
                      <th>{item.id}</th>
                      <td>{item.cycle_seconds.toFixed(2)} s</td>
                      <td>{item.drive_seconds.toFixed(2)} s</td>
                      <td>{item.recovery_seconds.toFixed(2)} s</td>
                      <td>{item.strokes_per_minute.toFixed(1)}</td>
                      {inspectRole === "candidate" ? (
                        <td>
                          <button
                            className="text-button"
                            onClick={() => {
                              setStroke(item.id - 1);
                              onSeek(item.catch_frame);
                            }}
                          >
                            View catch
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {inspected!.warnings.map((text) => (
              <p className="inline-warning" key={text}>
                {text}
              </p>
            ))}
          </details>
          <details className="inspector">
            <summary>Reproducibility & scientific limits</summary>
            <p>
              Algorithm: {report.algorithm_version} · coordinates:{" "}
              {report.config.coordinate_mode} · candidate mirrored for analysis:{" "}
              {String(report.config.mirror_candidate)}
            </p>
            <p>
              Coach features were loaded from a versioned precomputed profile;
              only the candidate pose was inferred in this session.
            </p>
            <p>
              sigma {report.config.smoothing_sigma} frames · catch prominence{" "}
              {report.config.catch_prominence}° · minimum catch spacing{" "}
              {report.config.min_stroke_seconds} seconds. Export the report for
              full settings, raw landmarks, fingerprints, video hashes and
              dependency versions.
            </p>
            <ul>
              {report.limitations.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}
