export function Method() {
  return (
    <article className="method">
      <h1>Understand the comparison.</h1>
      <p className="intro">
        A notebook you can inspect. A result you can question.
      </p>
      <section>
        <h2>From pixels to a stroke fingerprint</h2>
        <ol className="method-steps">
          <li>
            <strong>Decode the video</strong>
            <p>
              Sample at 30 points per second by seeking in the browser. These
              are sampled observations, not native encoded frame numbers. Slow
              or variable-rate source video can repeat frames; fast video can
              skip frames. One rower in a fixed side view is required.
            </p>
          </li>
          <li>
            <strong>Estimate body landmarks</strong>
            <p>
              The notebook’s MediaPipe Heavy model tracks 33 body points. The
              more visible body side supplies the angles. Visibility is an
              estimate, not a guarantee of accuracy.
            </p>
          </li>
          <li>
            <strong>Extract four angle signals</strong>
            <p>
              Knee: hip–knee–ankle. Hip: shoulder–hip–knee. Elbow:
              shoulder–elbow–wrist. Trunk: shoulder relative to the vertical
              through the hip.
            </p>
            <p>
              Pixel-corrected mode multiplies x by frame width and y by frame
              height before calculating angles. Notebook mode preserves the
              original normalized-coordinate calculation for reproducibility.
              These modes are not numerically interchangeable.
            </p>
          </li>
          <li>
            <strong>Smooth and find complete strokes</strong>
            <p>
              Interpolate missing values using the notebook’s pandas limit of
              five values in each direction. This can fill an interior gap of up
              to ten frames. Reject the clip if gaps remain. Apply Gaussian
              smoothing with sigma 2 frames. Knee-angle valleys identify
              catches, with 2-second minimum spacing and 15° prominence; the
              maximum between catches marks the finish.
            </p>
          </li>
          <li>
            <strong>Standardize and compare</strong>
            <p>
              Resample each drive to 40 points, then each recovery to 60 more,
              without duplicating the finish. Compare each candidate stroke
              against the mean of the reference strokes using root mean squared
              error (RMSE).
            </p>
            <code>RMSE = √mean((candidate − reference mean)²)</code>
            <p>
              Feature scores average squared errors over all candidate strokes
              and all 100 points. The overall score also averages across the
              four features with equal weight. This aggregation is a new,
              unvalidated extension—not an original notebook result.
            </p>
          </li>
        </ol>
      </section>
      <section>
        <h2>What this tool cannot tell you</h2>
        <p>
          A low difference is not proof of good or safe technique. The supplied
          video is a user-designated coach reference, not a validated gold
          standard. There is no scientific basis in the supplied material for a
          0–100 grade, injury prediction, or treatment advice.
        </p>
        <p>
          The supplied Video_1.mov is front-facing; it can be previewed but is
          blocked from this side-view comparison. Other uploads require your
          confirmation of a suitable camera view. A renamed copy of the same
          supplied clip is also blocked by its content hash.
        </p>
        <p>
          Neck and wrist measurements remain phase-two ideas in the notebook.
          Perspective, camera direction, body proportions, tracking error,
          fatigue and stroke rate can all affect comparisons. A mirrored
          candidate must be identified by the user; the tool does not detect
          camera suitability automatically.
        </p>
      </section>
      <section>
        <h2>Before using this as research evidence</h2>
        <ul>
          <li>
            Have a coach confirm the reference and manually label catches and
            finishes.
          </li>
          <li>Compare angle estimates with independently annotated frames.</li>
          <li>
            Test repeatability, different cameras, occlusions, and parameter
            sensitivity.
          </li>
          <li>
            Collect separate evaluation videos with consent; keep them out of
            method tuning.
          </li>
          <li>
            Define and validate a scoring rubric before claiming technique
            quality or injury relevance.
          </li>
        </ul>
      </section>
      <section>
        <h2>Local by design</h2>
        <p>
          Video analysis runs in your browser using a dedicated WebAssembly
          worker. Selected files are not uploaded. Results remain in browser
          memory until replaced, cleared, or the page is closed. Exported
          reports contain body landmarks—share them only with permission. The
          model and its runtime load from this site when analysis starts; videos
          are not sent to a cloud model. Cancel stops the worker.
        </p>
        <p>
          Engineering limits for this prototype: 100 MiB uploads, 120 seconds,
          3,600 sampled frames, 4K resolution and one analysis at a time. These
          are resource limits, not scientific thresholds. This is a static site
          suitable for Netlify. The bundled example videos are public site
          assets; permission to distribute them is still required. Real-device
          mobile performance and cross-browser scientific repeatability remain
          TODO.
        </p>
      </section>
      <section>
        <h2>Source material</h2>
        <p>
          Original:{" "}
          <code>Hagan_Lecture_5_Motion_and_Standardized_Stroke (1).ipynb</code>,
          preserved under <code>source/</code>. See the project’s SCIENCE.md and
          DECISIONS.md for traceability and changes.
        </p>
        <p>
          <a
            href="https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js"
            target="_blank"
            rel="noreferrer"
          >
            MediaPipe Pose Landmarker documentation
          </a>{" "}
          ·{" "}
          <a
            href="https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.find_peaks.html"
            target="_blank"
            rel="noreferrer"
          >
            SciPy peak detection
          </a>
        </p>
      </section>
    </article>
  );
}
