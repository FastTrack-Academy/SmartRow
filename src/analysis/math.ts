/** Numerical ports of the preserved Python/SciPy pipeline; no browser or UI APIs. */
export type Point = readonly [number, number];
export const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

export function angle(a: Point, b: Point, c: Point): number {
  const ba = [a[0] - b[0], a[1] - b[1]];
  const bc = [c[0] - b[0], c[1] - b[1]];
  const denominator = Math.hypot(...ba) * Math.hypot(...bc);
  if (denominator < 1e-8) return NaN;
  return (
    (Math.acos(
      Math.max(-1, Math.min(1, (ba[0] * bc[0] + ba[1] * bc[1]) / denominator)),
    ) *
      180) /
    Math.PI
  );
}

export function trunkLean(shoulder: Point, hip: Point): number {
  return (
    (Math.atan2(shoulder[0] - hip[0], -(shoulder[1] - hip[1])) * 180) / Math.PI
  );
}

/** pandas interpolate(limit=5, limit_direction='both'), including edge fills. */
export function interpolate(values: number[], limit: number): number[] {
  const result = [...values];
  let start = 0;
  while (start < values.length) {
    if (Number.isFinite(values[start])) {
      start++;
      continue;
    }
    let end = start;
    while (end < values.length && !Number.isFinite(values[end])) end++;
    const left = start > 0,
      right = end < values.length;
    for (let i = start; i < end; i++) {
      if (left && right && (i - start < limit || end - i <= limit)) {
        result[i] =
          values[start - 1] +
          ((values[end] - values[start - 1]) * (i - start + 1)) /
            (end - start + 1);
      } else if (left && !right && i - start < limit)
        result[i] = values[start - 1];
      else if (!left && right && end - i <= limit) result[i] = values[end];
    }
    start = end;
  }
  return result;
}

/** scipy.ndimage.gaussian_filter1d defaults: reflect, truncate=4, order=0. */
export function gaussian(values: number[], sigma: number): number[] {
  const radius = Math.floor(4 * sigma + 0.5);
  const weights = Array.from({ length: 2 * radius + 1 }, (_, i) =>
    Math.exp(-0.5 * ((i - radius) / sigma) ** 2),
  );
  const total = weights.reduce((sum, value) => sum + value, 0);
  return values.map((_, i) =>
    weights.reduce((sum, weight, k) => {
      let index = i + k - radius;
      while (index < 0 || index >= values.length) {
        if (index < 0) index = -index - 1;
        if (index >= values.length) index = 2 * values.length - index - 1;
      }
      return sum + (values[index] * weight) / total;
    }, 0),
  );
}

/** SciPy local maxima -> distance suppression -> prominence. Plateau midpoint rounds down.
 * Equal-height distance conflicts prefer the later index explicitly (SciPy ties are unspecified).
 */
export function findPeaks(
  values: number[],
  distance: number,
  prominence: number,
): number[] {
  const peaks: number[] = [];
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] <= values[i - 1]) continue;
    let end = i;
    while (end + 1 < values.length && values[end + 1] === values[i]) end++;
    if (end < values.length - 1 && values[end] > values[end + 1])
      peaks.push(Math.floor((i + end) / 2));
    i = end;
  }
  const kept: number[] = [];
  const priority = [...peaks].sort((a, b) => values[b] - values[a] || b - a);
  for (const peak of priority) {
    if (kept.every((other) => Math.abs(other - peak) >= distance))
      kept.push(peak);
  }
  return kept
    .sort((a, b) => a - b)
    .filter((peak) => {
      let left = values[peak],
        right = values[peak];
      for (let i = peak - 1; i >= 0 && values[i] <= values[peak]; i--)
        left = Math.min(left, values[i]);
      for (
        let i = peak + 1;
        i < values.length && values[i] <= values[peak];
        i++
      )
        right = Math.min(right, values[i]);
      return values[peak] - Math.max(left, right) >= prominence;
    });
}

export function resample(values: number[], count: number): number[] {
  if (values.length < 2 || count < 2)
    throw new Error(
      "At least two observations and target points are required.",
    );
  return Array.from({ length: count }, (_, i) => {
    const position = (i * (values.length - 1)) / (count - 1);
    const left = Math.floor(position),
      right = Math.min(left + 1, values.length - 1);
    return values[left] + (values[right] - values[left]) * (position - left);
  });
}
