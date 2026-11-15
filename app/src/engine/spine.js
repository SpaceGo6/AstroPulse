// Spine bone-density engine. Pure functions: data in, answer out.
// Pre-flight = ground DXA scans. In flight = spine ultrasound every 30 days, with the
// exercise log filling the gap between scans. Post-flight = projection to landing and recovery.
import { mean, sd } from './stats.js';

export const LANDING_WATCH_LOSS_PCT = 2.5;   // team-chosen: forecast landing loss above this = Watch
export const RESCAN_JUMP_PCT = 1.2;          // ~3x the ultrasound precision (0.4 %): confirm with a re-scan
export const ADHERENCE_WATCH = 0.7;          // under 70 % of the resistance-exercise target over 4 weeks
export const PAIN_RISE = 1.5;                // back pain 1.5 points above your usual (0-10 scale)
export const PAIN_ACT = 7;                   // severe pain: contact the flight surgeon now
export const VITD_LOW = 30;                  // ng/mL, common sufficiency cut-off

const r2 = (x) => Math.round(x * 100) / 100;
const r4 = (x) => Math.round(x * 10000) / 10000;

function adherence(rows, today, days, targetPerWeek) {
  const recent = rows.filter((r) => r.day > today - days && r.day <= today);
  if (!recent.length) return 1;
  return Math.min(1, recent.reduce((a, r) => a + r.ex_resist_min, 0) / ((targetPerWeek * recent.length) / 7));
}

// Spine % change today = last ultrasound + modelled loss since that scan (from the exercise log),
// then projected to landing at the current pace and back on target.
export function spineForecast(rows, crewSpine, model, today, landingDay) {
  const rate = (a) => model.loss_no_exercise_pct_per_month - (model.loss_no_exercise_pct_per_month - model.loss_full_exercise_pct_per_month) * a;
  const scans = crewSpine.flight.ultrasound.filter((u) => u.day <= today);
  const last = scans[scans.length - 1] || { day: 0, pct: 0 };
  let pct = last.pct;
  for (const r of rows.filter((x) => x.day > last.day && x.day <= today)) {
    pct -= rate(adherence(rows, r.day, 7, model.target_resist_min_per_week)) / 30;
  }
  const a28 = adherence(rows, today, 28, model.target_resist_min_per_week);
  const left = Math.max(0, landingDay - today);
  const landingCurrent = pct - (rate(a28) * left) / 30;
  const landingTarget = pct - (rate(1) * left) / 30;
  const pre = crewSpine.baseline.lumbar_bmd;
  return {
    lastScan: last, daysLeft: left, todayPct: r2(pct), todayBmd: r4(pre * (1 + pct / 100)),
    adherencePct: Math.round(a28 * 100), ratePerMonth: r2(rate(a28)),
    landingCurrentPct: r2(landingCurrent), landingTargetPct: r2(landingTarget),
    landingCurrentBmd: r4(pre * (1 + landingCurrent / 100)), landingTargetBmd: r4(pre * (1 + landingTarget / 100)),
    status: -landingCurrent > LANDING_WATCH_LOSS_PCT ? 'watch' : 'normal',
  };
}

// After landing bone comes back slowly (exponential, NASA fit). Returns % change at R+days.
export function recoveryPct(landingPct, daysAfter, halfLife) {
  return r2(landingPct * Math.pow(0.5, daysAfter / halfLife));
}

// Average spine density in each phase: ground (pre-flight), in flight, post-flight (projected).
export function spinePhases(crewSpine, forecast, model, today) {
  const pre = crewSpine.baseline.lumbar_bmd;
  const dxa = crewSpine.ground.filter((g) => g.test === 'DXA');
  const us = crewSpine.flight.ultrasound.filter((u) => u.day <= today);
  const inflight = [...us.map((u) => u.lumbar_bmd_est), forecast.todayBmd];
  const post = [0, 182, 365].map((d) => {
    const p = recoveryPct(forecast.landingCurrentPct, d, model.recovery_half_life_days);
    return { daysAfter: d, pct: p, bmd: r4(pre * (1 + p / 100)) };
  });
  return {
    ground: { avg: r4(mean(dxa.map((g) => g.lumbar_bmd))), n: dxa.length, scans: dxa },
    flight: { avg: r4(mean(inflight)), n: us.length, scans: us, todayBmd: forecast.todayBmd, todayPct: forecast.todayPct },
    post: { avg: r4(mean(post.map((p) => p.bmd))), points: post, projected: true },
    pre,
  };
}

export const WEEK_NUDGE = 0.8;               // under 80 % of this week's exercise target: a gentle nudge
export const PATTERN_MIN = 2;                // signals that must point the same way before we call it a pattern

// No single number proves bone loss (urine calcium alone, for example, can rise for other reasons).
// So each signal is checked against YOUR own baseline, and only several together raise an alert.
export function spineSignals({ rows, crewSpine, forecast, today }) {
  const f = crewSpine.flight;
  const urine = f.urine.filter((u) => u.day <= today);
  const early = urine.filter((u) => u.day <= 84);
  const last = urine[urine.length - 1];
  const limit = (k) => mean(early.map((u) => u[k])) + 2 * Math.max(sd(early.map((u) => u[k])), k === 'ntx' ? 2 : 8);
  const a28 = adherence(rows, today, 28, 150);
  const weekly = f.weekly.filter((w) => w.day <= today);
  const usual = weekly.filter((w) => w.week >= 3 && w.week <= 12).map((w) => w.pain_avg);
  const last4 = weekly.slice(-4);
  const last4Avg = last4.length ? mean(last4.map((w) => w.pain_avg)) : 0;
  const ntxLim = early.length >= 3 ? limit('ntx') : Infinity;
  const caLim = early.length >= 3 && last?.calcium != null ? limit('calcium') : Infinity;
  return [
    { id: 'exercise', label: 'Exercise, last 4 weeks', on: a28 < ADHERENCE_WATCH,
      detail: `${Math.round(a28 * 100)}% of the 150 min/week target (signal under ${ADHERENCE_WATCH * 100}%)` },
    { id: 'ntx', label: 'Urine NTx (bone breakdown)', on: !!last && last.ntx > ntxLim,
      detail: last ? `${last.ntx} on day ${last.day}; your space baseline limit ${ntxLim.toFixed(0)}` : 'No sample yet' },
    { id: 'urine_ca', label: 'Urine calcium', on: !!last && last.calcium > caLim,
      detail: last?.calcium != null ? `${last.calcium} mg/day on day ${last.day}; your limit ${caLim.toFixed(0)}` : 'No sample yet' },
    { id: 'scan', label: 'Spine scans + forecast', on: forecast.status === 'watch',
      detail: `Landing forecast ${forecast.landingCurrentPct}% at current pace (watch level −${LANDING_WATCH_LOSS_PCT}%)` },
    { id: 'pain', label: 'Back pain and posture', on: usual.length > 0 && last4Avg >= mean(usual) + PAIN_RISE,
      detail: `${last4Avg.toFixed(1)}/10 over 4 weeks vs your usual ${usual.length ? mean(usual).toFixed(1) : '–'}/10` },
  ];
}

// Alerts: one pattern alert when signals agree, plus a few single-cause nudges with an obvious fix.
export function spineAlerts({ rows, crewSpine, forecast, today, reports = [] }) {
  const out = [];
  const signals = spineSignals({ rows, crewSpine, forecast, today });
  const on = signals.filter((x) => x.on);

  const severe = reports.find((r) => r.pain >= PAIN_ACT);
  if (severe) {
    out.push({ id: 'severe', status: 'act', title: 'Severe back pain reported',
      why: `You reported ${severe.pain}/10 (${severe.where}). Sudden severe pain can mean a disc or vertebra injury.`, plan: ['surgeon'] });
  }
  if (on.length >= PATTERN_MIN) {
    out.push({ id: 'pattern', status: 'watch', title: `Bone-loss pattern: ${on.length} of ${signals.length} signals agree`,
      why: `${on.map((x) => x.label.split(',')[0].split(' (')[0]).join(', ')} all point the same way. One of these alone could be noise; together they suggest bone loss is speeding up.`,
      plan: ['exercise', 'food', 'medication'] });
  }

  // this week's exercise: a gentle nudge with what it costs if it continues
  const a7 = adherence(rows, today, 7, 150);
  if (a7 < WEEK_NUDGE) {
    const rate = (a) => 1.0 - 0.7 * a; // %/month, same model as the forecast
    const extra = ((rate(a7) - rate(1)) / 30) * (forecast.daysLeft ?? 30);
    out.push({ id: 'week', status: 'watch', title: 'Exercise is behind this week',
      why: `${Math.round(a7 * 150)} of 150 resistance minutes in the last 7 days. If this pace continued to landing, your spine would land about ${extra.toFixed(2)}% lower than on target, and back pain and bone breakdown tend to rise when loading drops. Catching up on loaded sessions this week undoes most of it.`,
      plan: ['exercise'] });
  }

  const blood = crewSpine.flight.blood.filter((b) => b.day <= today);
  const lb = blood[blood.length - 1];
  if (lb && lb.vitd < VITD_LOW) {
    out.push({ id: 'vitd', status: 'watch', title: 'Vitamin D is low',
      why: `Last blood test (day ${lb.day}): ${lb.vitd} ng/mL, under ${VITD_LOW}. There is no sunlight in a spacecraft, so vitamin D comes from food and supplements.`,
      plan: ['food'] });
  }

  const us = crewSpine.flight.ultrasound.filter((u) => u.day <= today);
  if (us.length >= 2 && Math.abs(us[us.length - 1].pct - us[us.length - 2].pct) > RESCAN_JUMP_PCT) {
    out.push({ id: 'rescan', status: 'watch', title: 'Last ultrasound changed a lot: re-scan',
      why: `Day ${us[us.length - 2].day} → ${us[us.length - 1].day}: ${us[us.length - 2].pct}% → ${us[us.length - 1].pct}%. That is more than the device's usual error, so confirm it first.`,
      plan: ['rescan'] });
  }
  return out;
}

// What to do, always in this order: exercise first, then food, then (ground doctors decide) medication.
export const PLAN_ORDER = ['exercise', 'food', 'medication'];

export const PREVENTION = {
  exercise: { step: 1, title: 'Exercise', items: ['Loaded squats and deadlifts on the resistance machine (ARED), 3–6 days a week', 'Heel raises and loaded lunges', 'Core: bird-dog, side plank holds, back extensions', 'Treadmill with the harness pulling you down'] },
  food: { step: 2, title: 'Food', items: ['Calcium-rich foods spread across the day', 'Vitamin D supplement as prescribed (no sunlight on board)', 'Enough calories and protein: under-eating speeds up bone loss', 'Go easy on salty food; drink 2+ L of water (kidney-stone risk)'] },
  medication: { step: 3, title: 'Medication (ground doctors decide)', items: ['Only if the pattern stays after 4 weeks of steps 1 and 2', 'Ground doctors may consider a bone-protecting drug (bisphosphonate)', 'On the ISS, alendronate plus resistance exercise protected spine and hip bone (LeBlanc 2013)'] },
  back: { title: 'Back care', items: ['"Fetal tuck" stretch when the lower back aches', 'Posture check: shoulders back, neutral spine, during long work at a panel', 'Report pain in the check-in so the trend is visible'] },
  surgeon: { title: 'Do now', items: ['Stop loaded exercise for today', 'Contact the flight surgeon (sent with the next downlink)', 'Note where it hurts and whether it spreads to a leg'] },
  rescan: { title: 'Do next', items: ['Repeat the spine ultrasound in the same position', 'Keep your usual exercise until the re-scan is in'] },
};

// Report packet for the ground doctors. The hash lets them check nothing changed on the way down.
export function downlinkPacket({ crew, today, phases, forecast, alerts, crewSpine, reports, signals = [], imaging = [] }) {
  const f = crewSpine.flight;
  return {
    type: 'SPINE_REPORT', crew: { id: crew.id, name: crew.name }, mission_day: today,
    averages_g_cm2: { preflight_ground: phases.ground.avg, in_flight: phases.flight.avg, post_flight_projected: phases.post.avg },
    today: { lumbar_bmd_est: forecast.todayBmd, pct_vs_preflight: forecast.todayPct },
    forecast_landing: { current_pace_pct: forecast.landingCurrentPct, on_target_pct: forecast.landingTargetPct, exercise_adherence_pct: forecast.adherencePct },
    latest: { ultrasound: f.ultrasound.filter((u) => u.day <= today).slice(-1)[0], urine: f.urine.filter((u) => u.day <= today).slice(-1)[0], blood: f.blood.filter((u) => u.day <= today).slice(-1)[0], week: f.weekly.filter((w) => w.day <= today).slice(-1)[0] },
    signals: signals.map((x) => ({ id: x.id, on: x.on, detail: x.detail })),
    alerts: alerts.map((a) => ({ status: a.status, title: a.title, why: a.why })),
    imaging: imaging.map((m) => ({ day: m.day, test: m.test, lumbar_bmd: m.lumbar_bmd_est ?? null, image: m.image ? { name: m.imageName, sha256: m.imageHash } : null,
      concept_ai_result: m.analysis ? { status: m.analysis.status, estimate: m.analysis.estimate, label: m.analysis.label } : null })),
    crew_reports: reports,
    note: 'Decision support only. Ground medical team reviews and decides.',
  };
}
