// AstroPulse engine: baseline, status, re-measure check, forecast, watchdog.
// Every function is pure (data in, answer out) so it is easy to test and explain.
import { baseline, zScore, sd } from './stats.js';
import { byId } from './indicators.js';

export const BASELINE_DAYS = 14;
export const GAP_DAYS = 5;        // baseline ends 5 days before today so a recent drift does not hide itself
export const WATCH_Z = 2;         // 2 SD from personal baseline...
export const WATCH_RUN = 3;       // ...for 3 days in a row = Watch
export const REMEASURE_Z = 3;     // a single jump > 3 SD of the usual day-to-day change = re-measure

export const rowsFor = (daily, crewId) => daily.filter((r) => r.crew_id === crewId).sort((a, b) => a.day - b.day);

function windowValues(rows, field, fromDay, toDay) {
  return rows.filter((r) => r.day >= fromDay && r.day <= toDay).map((r) => r[field]);
}

// Personal baseline for one field, ending GAP_DAYS before `day`.
export function personalBaseline(rows, field, day, minSd = 0) {
  const end = day - GAP_DAYS;
  return baseline(windowValues(rows, field, end - BASELINE_DAYS + 1, end), minSd);
}

// Hard limits from rules.json, e.g. {bp_sys_gte:160} or {spo2_lt:90}.
const LIMIT_FIELDS = { bp_sys: 'bp_sys', bp_dia: 'bp_dia', hr: 'hr_rest', spo2: 'spo2_min', glucose: 'glucose', temp: 'temp' };
export function breaksLimit(row, actLimit) {
  if (!actLimit) return null;
  for (const [key, limit] of Object.entries(actLimit)) {
    const m = key.match(/^(.*)_(gte|lt)$/);
    if (!m) continue;
    const field = LIMIT_FIELDS[m[1]] || m[1];
    const v = row[field];
    if (v == null) continue;
    if ((m[2] === 'gte' && v >= limit) || (m[2] === 'lt' && v < limit)) return { field, value: v, limit, op: m[2] };
  }
  return null;
}

// Bone: project from today to landing using the last 28 days of exercise.
// monthly loss = no-exercise rate - (no-exercise rate - full-exercise rate) x adherence
export function boneForecast(rows, today, rules, landingDay = rows[rows.length - 1].day) {
  const rule = rules.indicators.find((i) => i.id === 'bone');
  const m = rule.model;
  const now = rows.find((r) => r.day === today);
  const recent = rows.filter((r) => r.day > today - 28 && r.day <= today);
  const adherence = Math.min(1, recent.reduce((a, r) => a + r.ex_resist_min, 0) / (m.resist_target_min_per_week * recent.length / 7));
  const rate = (a) => m.loss_no_exercise_pct_per_month - (m.loss_no_exercise_pct_per_month - m.loss_full_exercise_pct_per_month) * a;
  const daysLeft = landingDay - today;
  const project = (a) => +(now.bone_pct_est - (rate(a) * daysLeft) / 30).toFixed(2);
  const landingCurrent = project(adherence);
  const landingLoss = 100 - landingCurrent;
  const week = rows.filter((r) => r.day > today - 7 && r.day <= today).reduce((a, r) => a + r.ex_resist_min, 0);
  return {
    today: now.bone_pct_est,
    adherencePct: Math.round(adherence * 100),
    ratePerMonthCurrent: +rate(adherence).toFixed(2),
    landingDay,
    landingCurrent,
    landingOnTarget: project(1),
    landingLossPct: +landingLoss.toFixed(2),
    watchLevel: 100 - rule.watch_if_landing_loss_pct_gt,
    weekResistMin: week,
    targetMin: m.resist_target_min_per_week,
    status: landingLoss > rule.watch_if_landing_loss_pct_gt ? 'watch' : 'normal',
  };
}

export function radiationStatus(env, today, rules) {
  const rule = rules.indicators.find((i) => i.id === 'radiation');
  const row = env.find((e) => e.day === today);
  const solarNow = env.some((e) => e.solar_event && e.day <= today && e.day > today - 2);
  return { cum: row.rad_cum_msv, pct: row.rad_pct_career_limit, limit: rule.career_limit_msv,
    status: solarNow ? 'act' : row.rad_pct_career_limit >= 80 ? 'watch' : 'normal', solarNow };
}

// Status of one indicator on `day` for one crew member.
export function indicatorStatus(indicatorId, rows, day, rules, env) {
  const ind = byId[indicatorId];
  if (indicatorId === 'bone') {
    const f = boneForecast(rows, day, rules);
    return { status: f.status, value: f.weekResistMin, note: f.status === 'watch' ? 'Landing forecast past watch level' : 'On track', forecast: f };
  }
  if (indicatorId === 'radiation') {
    const r = radiationStatus(env, day, rules);
    return { status: r.status, value: r.cum, note: `${r.pct}% of ${r.limit} mSv career limit`, radiation: r };
  }
  const rule = rules.indicators.find((i) => i.id === ind.ruleId);
  const today = rows.find((r) => r.day === day);
  const base = personalBaseline(rows, ind.field, day, ind.minSd);
  const recent = rows.filter((r) => r.day > day - WATCH_RUN && r.day <= day);
  const zs = recent.map((r) => zScore(r[ind.field], base));
  const limit = breaksLimit(today, rule?.act_limit);
  const allHigh = zs.length === WATCH_RUN && zs.every((z) => z >= WATCH_Z);
  const allLow = zs.length === WATCH_RUN && zs.every((z) => z <= -WATCH_Z);
  let status = 'normal';
  let note = 'Within your baseline';
  if (limit) { status = 'act'; note = `Past the safety limit (${limit.limit})`; }
  else if (ind.watchBelow != null && recent.length === WATCH_RUN && recent.every((r) => r[ind.field] < ind.watchBelow)) {
    status = 'watch';
    note = `Under ${ind.watchBelow} ${ind.unit} for ${WATCH_RUN}+ days`;
  }
  else if (allHigh || allLow) {
    status = 'watch';
    note = `${allHigh ? 'Above' : 'Below'} your space baseline ${WATCH_RUN}+ days`;
  }
  return { status, value: today[ind.field], note, baseline: base, z: zs[zs.length - 1] ?? 0, row: today };
}

export function allStatuses(rows, day, rules, env, ids) {
  return Object.fromEntries(ids.map((id) => [id, indicatorStatus(id, rows, day, rules, env)]));
}

// Re-measure check: is this new reading a much bigger jump than this person's
// normal day-to-day change? Uses the last 14 days of differences.
export function needsRemeasure(rows, field, day, newValue, minSdDiff = 2) {
  const hist = rows.filter((r) => r.day < day && r.day >= day - BASELINE_DAYS - 1).map((r) => r[field]);
  if (hist.length < 3) return { remeasure: false };
  const diffs = hist.slice(1).map((v, i) => v - hist[i]);
  const spread = Math.max(sd(diffs), minSdDiff);
  const yesterday = hist[hist.length - 1];
  const jump = newValue - yesterday;
  // Only suspicious if it is a big jump AND it moves further away from this person's normal.
  // (A reading that comes back toward baseline is good news, not a measuring error.)
  const base = personalBaseline(rows, field, day);
  const movesAway = Math.abs(newValue - base.mean) > Math.abs(yesterday - base.mean);
  return { remeasure: Math.abs(jump) > REMEASURE_Z * spread && movesAway, jump, spread: +spread.toFixed(2), yesterday };
}

// Watchdog on the per-minute wearable feed: first minute where TWO vitals are
// out of range together (heart rate high AND oxygen low).
export function watchdog(streamRows, { hrHigh = 130, spo2Low = 90 } = {}) {
  for (const r of streamRows) {
    if (r.hr > hrHigh && r.spo2 < spo2Low) {
      return { minute: r.minute, hr: r.hr, spo2: r.spo2, trigger: `HR ${r.hr} > ${hrHigh} and SpO2 ${r.spo2} < ${spo2Low}` };
    }
  }
  return null;
}
