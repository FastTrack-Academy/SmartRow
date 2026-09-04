import { useEffect, useRef, useState } from "react";
import type {
  AnalysisProgress,
  ComparisonReport,
  CoordinateMode,
} from "./contracts";
import { validateVideo } from "./files";
import { CANDIDATE_URL, REFERENCE_URL } from "./analysis/assets";
import { browserSupportError } from "./analysis/pose-client";
import { Icon } from "./components/Icon";
import { Method } from "./components/Method";
import { Results } from "./components/Results";
import { VideoPanel } from "./components/VideoPanel";

export default function App() {
  const [page, setPage] = useState<"compare" | "method">("compare");
  const [file, setFile] = useState<File | null>(null);
  const [sample, setSample] = useState(false);
  const [preview, setPreview] = useState("");
  const [mode, setMode] = useState<CoordinateMode>("pixel");
  const [mirror, setMirror] = useState(false);
  const [report, setReport] = useState<ComparisonReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [supportError] = useState(browserSupportError);
  const [dragging, setDragging] = useState(false);
  const [sideViewConfirmed, setSideViewConfirmed] = useState(false);
  const runningRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const candidateRef = useRef<HTMLVideoElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function chooseVideo(next: File) {
    if (busy) return;
    const problem = validateVideo(next);
    if (problem) {
      clear();
      setError(problem);
      return;
    }
    setFile(next);
    setSample(false);
    setSideViewConfirmed(false);
    setReport(null);
    setError("");
  }
  function clear() {
    setFile(null);
    setSample(false);
    setSideViewConfirmed(false);
    setReport(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }
  async function runAnalysis() {
    if (runningRef.current || !sideViewConfirmed || sample || !file) return;
    runningRef.current = true;
    setBusy(true);
    setError("");
    setReport(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { analyzeVideo } = await import("./analysis/service");
      const next = await analyzeVideo(
        file,
        mode,
        mirror,
        controller.signal,
        setProgress,
      );
      setReport(next);
      requestAnimationFrame(() =>
        resultsRef.current?.scrollIntoView({
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "start",
        }),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Browser analysis could not complete. Try a shorter supported video.",
      );
    } finally {
      runningRef.current = false;
      setBusy(false);
      setProgress(null);
      abortRef.current = null;
    }
  }
  const selected = file !== null || sample;
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to workspace
      </a>
      <header>
        <a
          href="#"
          className="wordmark"
          onClick={(event) => {
            event.preventDefault();
            setPage("compare");
          }}
        >
          IQ<span>Row</span>
        </a>
        <nav aria-label="Main navigation">
          <button
            className={page === "compare" ? "selected" : ""}
            onClick={() => setPage("compare")}
          >
            Compare
          </button>
          <button
            className={page === "method" ? "selected" : ""}
            onClick={() => setPage("method")}
          >
            Method &amp; limits
          </button>
        </nav>
        <span className="workspace-label">Browser research workspace</span>
      </header>
      <main id="main">
        {page === "method" ? (
          <Method />
        ) : (
          <>
            <div className="intro-heading">
              <h1>Every stroke tells a story.</h1>
              <p>
                Compare your rowing motion with a reference. Understand the
                differences.
              </p>
            </div>
            <ol className="steps" aria-label="Analysis progress">
              <li className="current">
                <b>01</b> Videos
              </li>
              <li className={busy || report ? "current" : ""}>
                <b>02</b> Motion analysis
              </li>
              <li className={report ? "current" : ""}>
                <b>03</b> Comparison
              </li>
            </ol>
            {supportError ? (
              <div className="notice error" role="alert">
                <p>{supportError}</p>
              </div>
            ) : null}
            <div className="video-grid">
              <section className="video-panel">
                <div className="video-heading">
                  <div>
                    <h2>Coach reference</h2>
                    <p>Video.mov</p>
                  </div>
                </div>
                <VideoPanel
                  src={REFERENCE_URL}
                  label="Coach reference video"
                  analysis={report?.reference}
                />
                <p className="reference-caption">
                  Supplied reference · not a universal gold standard
                </p>
              </section>
              <section className="video-panel">
                <div className="video-heading">
                  <div>
                    <h2>Your rowing video</h2>
                    <p>
                      {file?.name ??
                        (sample
                          ? "Video_1.mov · supplied candidate"
                          : "\u00a0")}
                    </p>
                  </div>
                  {selected ? (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={clear}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
                <input
                  ref={inputRef}
                  id="video-file"
                  className="sr-only"
                  type="file"
                  accept=".mp4,.mov,.m4v,.webm,video/*"
                  disabled={busy}
                  onChange={(event) => {
                    const next = event.target.files?.[0];
                    if (next) chooseVideo(next);
                    event.target.value = "";
                  }}
                />
                {selected ? (
                  <VideoPanel
                    key={sample ? "sample" : preview}
                    ref={candidateRef}
                    src={sample ? CANDIDATE_URL : preview}
                    label="Candidate rowing video"
                    analysis={report?.candidate}
                  />
                ) : (
                  <div
                    className={`dropzone ${dragging ? "dragging" : ""}`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragging(false);
                      const files = event.dataTransfer.files;
                      if (files.length !== 1)
                        setError("Choose one candidate video at a time.");
                      else chooseVideo(files[0]);
                    }}
                  >
                    <Icon name="upload" size={42} />
                    <h3>Drop a rowing video here</h3>
                    <p>or choose a file</p>
                    <button
                      className="button"
                      onClick={() => inputRef.current?.click()}
                    >
                      Choose video
                    </button>
                    <button
                      className="text-button"
                      onClick={() => {
                        setSample(true);
                        setFile(null);
                        setError("");
                      }}
                    >
                      Use supplied candidate
                    </button>
                  </div>
                )}
                {selected ? (
                  <p className="reference-caption">
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => inputRef.current?.click()}
                    >
                      Choose another video
                    </button>
                  </p>
                ) : null}
              </section>
            </div>
            {sample ? (
              <div className="notice error" role="alert">
                <Icon name="info" />
                <p>
                  The supplied candidate is front-facing. This 2D side-view
                  method cannot validly compare it with the coach reference.
                  Upload a fixed side-view recording instead. No score will be
                  produced for this clip.
                </p>
              </div>
            ) : null}
            {file ? (
              <label className="capture-confirmation">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={sideViewConfirmed}
                  onChange={(event) =>
                    setSideViewConfirmed(event.target.checked)
                  }
                />{" "}
                I confirm this shows one rower in a fixed, full-body side view
                comparable to the reference.
              </label>
            ) : null}
            <div className="analysis-controls">
              <label>
                Angle coordinates
                <select
                  value={mode}
                  disabled={busy}
                  onChange={(event) => {
                    setMode(event.target.value as CoordinateMode);
                    setReport(null);
                  }}
                >
                  <option value="pixel">Pixel-corrected</option>
                  <option value="notebook">Notebook original</option>
                </select>
              </label>
              <label>
                Candidate facing
                <select
                  value={String(mirror)}
                  disabled={busy}
                  onChange={(event) => {
                    setMirror(event.target.value === "true");
                    setReport(null);
                  }}
                >
                  <option value="false">Same as reference</option>
                  <option value="true">
                    Opposite to reference (mirror analysis)
                  </option>
                </select>
              </label>
              <button
                className="button primary-action"
                disabled={
                  !selected ||
                  sample ||
                  !sideViewConfirmed ||
                  busy ||
                  !!supportError
                }
                onClick={runAnalysis}
              >
                {busy ? (
                  <>
                    <span className="spinner" /> Analyzing video…
                  </>
                ) : (
                  <>
                    Analyze &amp; compare
                    <Icon name="arrow" />
                  </>
                )}
              </button>
            </div>
            <p className="capture-note">
              One rower. Fixed side view. Full body visible.
            </p>
            <p className="limits-note">
              Browser-supported MP4, MOV, M4V or WebM · Up to 100 MiB / 120 s ·
              Sampled at 30 Hz · Video stays in your browser
            </p>
            {busy ? (
              <div className="notice processing" role="status">
                <span className="spinner" />
                <div>
                  <strong>
                    {progress?.message ?? "Starting browser analysis…"}
                  </strong>
                  <p>
                    The first run processes the reference too. This may take a
                    few minutes. Keep this page open. No video upload is
                    required.
                  </p>
                  {progress?.total ? (
                    <progress
                      aria-label={`${progress.stage} sampled frames`}
                      value={progress.completed}
                      max={progress.total}
                    />
                  ) : null}
                  <button
                    className="text-button"
                    onClick={() => abortRef.current?.abort()}
                  >
                    Cancel analysis
                  </button>
                </div>
              </div>
            ) : null}
            {error ? (
              <div className="notice error" role="alert">
                <Icon name="info" />
                <p>{error}</p>
              </div>
            ) : null}
            <div ref={resultsRef}>
              <Results
                key={report?.created_at ?? "empty"}
                report={report}
                onSeek={(frame) => {
                  if (candidateRef.current && report) {
                    candidateRef.current.currentTime =
                      frame / report.candidate.video.fps;
                    candidateRef.current.pause();
                    candidateRef.current.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  }
                }}
              />
            </div>
            <aside className="safety-note">
              <Icon name="info" size={29} />
              <div>
                <h3>Research, not diagnosis</h3>
                <p>
                  Similarity does not establish safe technique. Injury
                  prediction and a validated 0–100 score remain future research.
                </p>
              </div>
            </aside>
          </>
        )}
      </main>
      <footer>
        Video <Icon name="arrow" size={15} /> Landmarks{" "}
        <Icon name="arrow" size={15} /> Angles <Icon name="arrow" size={15} />{" "}
        Strokes <Icon name="arrow" size={15} /> Comparison
      </footer>
    </>
  );
}
