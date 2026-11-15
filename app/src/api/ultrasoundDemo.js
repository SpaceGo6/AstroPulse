// CONCEPT DEMO ONLY: on-board stand-in for a future model that reads spine ultrasound.
// Nothing here measures bone density. The image checks use the real picture; the estimate and
// the trend are static prototype numbers so the page works with no backend.
// The starting value (1.045 g/cm²) is the real mean pre-bed-rest L1–L4 density of NASA study
// MR035G participants; the decline (~0.9 % per 30 days) follows published spaceflight rates.
import { sha256 } from '../audit/sha256.js';

export const ULTRASOUND_LABEL = 'Concept demo: simulated AI output, not a bone density measurement';
const UNIT = 'g/cm2';
const DRIFT_PER_30_DAYS = -0.009;
const NOISE = 0.003;
const HALF_RANGE = 0.03;
const QUALITY_LIMITS = { minBrightness: 15, maxBrightness: 200, minContrast: 10, minSharpness: 1.5, minSide: 200 };

const SEED = [
  [-7, 'preflight', 1.045], [30, 'inflight', 1.036], [60, 'inflight', 1.027], [90, 'inflight', 1.017],
];

const round = (x, d = 4) => Number(x.toFixed(d));

// Session copy of the static trend, plus any scan analyzed in this browser.
let history = [];

function seedRow(crewId, [missionDay, phase, lumbarBmd]) {
  return { crewId, missionDay, phase, lumbarBmd, unit: UNIT, imageHash: null, source: 'simulated_seed' };
}

export function resetUltrasoundDemo() {
  history = [];
}

function ensureSeed(crewId) {
  if (history.some((r) => r.crewId === crewId)) return;
  history.push(...SEED.map((row) => seedRow(crewId, row)));
}

function hashNoise(hash, salt) {
  const n = parseInt(sha256(`${hash}:${salt}`).slice(0, 8), 16);
  return (n / 0xffffffff) * 2 - 1;
}

function checkQuality(image = {}) {
  const issues = [];
  const { width, height, brightness, contrast, sharpness } = image;
  const L = QUALITY_LIMITS;
  if (![width, height, brightness, contrast, sharpness].every(Number.isFinite)) {
    return { verdict: 'unreadable', issues: ['Image statistics are missing or invalid'] };
  }
  if (Math.min(width, height) < L.minSide) issues.push(`Image is small (${width}×${height}); use a full-resolution capture`);
  if (brightness < L.minBrightness) issues.push('Image is too dark');
  if (brightness > L.maxBrightness) issues.push('Image is washed out');
  if (contrast < L.minContrast) issues.push('Very low contrast: probe contact may be poor');
  if (sharpness < L.minSharpness) issues.push('Image looks blurred: hold the probe still and re-scan');
  return { verdict: issues.length ? 'rescan' : 'ok', issues };
}

function trendFor(records) {
  const pts = [...records].sort((a, b) => a.missionDay - b.missionDay);
  if (pts.length < 2) return { status: 'insufficient_data', points: pts };
  const base = pts.filter((p) => p.phase === 'preflight').at(-1) ?? pts[0];
  const last = pts.at(-1);
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.missionDay, 0) / n;
  const my = pts.reduce((s, p) => s + p.lumbarBmd, 0) / n;
  const den = pts.reduce((s, p) => s + (p.missionDay - mx) ** 2, 0);
  const slope = den ? pts.reduce((s, p) => s + (p.missionDay - mx) * (p.lumbarBmd - my), 0) / den : 0;
  return {
    status: 'analyzed',
    unit: UNIT,
    baseline: { missionDay: base.missionDay, lumbarBmd: base.lumbarBmd },
    latest: { missionDay: last.missionDay, lumbarBmd: last.lumbarBmd },
    changePercentFromBaseline: round(((last.lumbarBmd - base.lumbarBmd) / base.lumbarBmd) * 100, 2),
    observedSlopePer30Days: round(slope * 30, 4),
    points: pts.map((p) => ({ missionDay: p.missionDay, value: p.lumbarBmd, phase: p.phase, source: p.source })),
  };
}

export function ultrasoundTrend(crewId) {
  ensureSeed(crewId);
  return trendFor(history.filter((r) => r.crewId === crewId));
}

export function analyzeUltrasoundDemo({ crewId, missionDay, image }) {
  ensureSeed(crewId);
  const quality = checkQuality(image);
  const mine = history.filter((r) => r.crewId === crewId).sort((a, b) => a.missionDay - b.missionDay);
  const previous = mine.filter((r) => r.missionDay <= missionDay && r.imageHash !== image?.sha256).at(-1) ?? null;
  const baseline = mine.filter((r) => r.phase === 'preflight').at(-1) ?? null;
  const pipeline = [
    { step: 'Image quality check', status: quality.verdict === 'ok' ? 'passed' : 'failed' },
    { step: 'Find lumbar vertebrae L1–L4', status: quality.verdict === 'ok' ? 'simulated' : 'skipped' },
    { step: 'Estimate bone density', status: quality.verdict === 'ok' ? 'simulated' : 'skipped' },
    { step: "Compare with this astronaut's history", status: quality.verdict === 'ok' && previous ? 'done' : 'skipped' },
  ];
  const base = { crewId, missionDay, concept: true, source: 'simulated', label: ULTRASOUND_LABEL, quality, pipeline };
  if (quality.verdict !== 'ok') {
    return {
      ...base, status: 'rescan_needed', estimate: null, regions: [], comparison: null,
      nextStep: 'Re-scan, then analyze again. Nothing was saved to the trend.',
    };
  }

  const start = previous ?? baseline ?? { missionDay: 0, lumbarBmd: 1.045 };
  const days = Math.max(0, missionDay - start.missionDay);
  const value = start.lumbarBmd * (1 + DRIFT_PER_30_DAYS * (days / 30) + NOISE * hashNoise(image.sha256, 'v'));
  const lumbarBmd = round(value);
  const regions = ['L1', 'L2', 'L3', 'L4'].map((name, i) => ({
    name, lumbarBmd: round(value * (0.94 + i * 0.04) * (1 + 0.004 * hashNoise(image.sha256, name))),
  }));
  const record = {
    crewId, missionDay, phase: missionDay < 0 ? 'preflight' : 'inflight', lumbarBmd, unit: UNIT,
    imageHash: image.sha256, source: 'simulated_ai_concept',
  };
  history = history.filter((r) => !(r.crewId === crewId && (r.imageHash === image.sha256 || (r.missionDay === missionDay && r.source === 'simulated_ai_concept'))));
  history.push(record);

  const pct = (a, b) => round(((a - b) / b) * 100, 2);
  return {
    ...base,
    status: 'estimated',
    estimate: { lumbarBmd, low: round(value - HALF_RANGE), high: round(value + HALF_RANGE), unit: UNIT },
    regions,
    comparison: {
      previous: previous ? { missionDay: previous.missionDay, lumbarBmd: previous.lumbarBmd, changePercent: pct(lumbarBmd, previous.lumbarBmd) } : null,
      baseline: baseline ? { missionDay: baseline.missionDay, lumbarBmd: baseline.lumbarBmd, changePercent: pct(lumbarBmd, baseline.lumbarBmd) } : null,
    },
    nextStep: 'Saved with this report for ground doctors to check against the device reading. A real model would need validation against DXA scans.',
  };
}
