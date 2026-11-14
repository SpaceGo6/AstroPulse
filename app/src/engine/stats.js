// Small statistics helpers. Pure functions: no React, no fetching.

export function mean(xs) {
  if (!xs.length) return NaN;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function sd(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

// Personal baseline from a window of values. minSd stops a very steady person
// from turning every tiny wobble into an alert.
export function baseline(values, minSd = 0) {
  const clean = values.filter((v) => Number.isFinite(v));
  return { mean: mean(clean), sd: Math.max(sd(clean), minSd), n: clean.length };
}

export function zScore(value, base) {
  if (!base.sd) return 0;
  return (value - base.mean) / base.sd;
}
