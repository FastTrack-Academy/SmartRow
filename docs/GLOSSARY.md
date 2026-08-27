# Glossary

- **Landmark:** estimated body point, not a directly measured joint centre.
- **Visibility:** model estimate of whether a landmark is visible; not measurement accuracy.
- **Active side:** left/right body side with higher average selected-joint visibility.
- **Image-plane angle:** angle measured in the two-dimensional recording, affected by viewpoint.
- **Catch:** detected knee-angle local minimum used as a stroke boundary in this method.
- **Finish:** maximum knee angle between two catches.
- **Drive / recovery:** catch-to-finish / finish-to-next-catch phases.
- **Interpolation:** estimating missing or resampled values; not creating new observations.
- **Gaussian smoothing:** weighted averaging of neighboring measurements to reduce jitter.
- **Prominence:** how strongly a peak/valley stands out from its surroundings.
- **Fingerprint:** a complete stroke represented by 100 points × four angle features.
- **RMSE:** root mean squared error; here a difference in degrees, not a percentage score.
- **Reference variability:** standard deviation among reference strokes; not confidence or safety bounds.
- **Self-comparison:** comparing a file's strokes to their own mean; a software check, not held-out evaluation.
- **Provenance:** source identity, settings and software/model versions needed to understand a result.
- **Sampling grid (v2):** requested video observations at index/30 seconds; sample indices are not native encoded-frame numbers. Source frames can repeat or be skipped.
- **Web worker:** a separate browser execution context used to keep heavy pose estimation from blocking the interface.
- **Static hosting:** delivery of prebuilt files; no application server runs on Netlify for this project.
