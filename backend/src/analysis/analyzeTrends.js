import { metricDefinitions } from "../mockApi/mockData.js";

const round = (number, digits = 2) => Number(number.toFixed(digits));

// Observed linear slope, not a future prediction or a clinical risk score.
function observedSlopePerDay(points) {
  const meanDay = points.reduce((sum, p) => sum + p.missionDay, 0) / points.length;
  const meanValue = points.reduce((sum, p) => sum + p.value, 0) / points.length;
  const numerator = points.reduce(
    (sum, p) => sum + (p.missionDay - meanDay) * (p.value - meanValue),
    0
  );
  const denominator = points.reduce(
    (sum, p) => sum + (p.missionDay - meanDay) ** 2,
    0
  );
  return denominator === 0 ? null : numerator / denominator;
}

/** Descriptive analysis of serial lab results. Not a bone-density predictor. */
export function analyzeTrends(readings, astronautId, expectedIntervalDays = 30) {
  if (!Number.isFinite(expectedIntervalDays) || expectedIntervalDays <= 0) {
    throw new TypeError("expectedIntervalDays must be positive");
  }

  const metrics = {};
  for (const metric of Object.keys(metricDefinitions)) {
    const records = readings
      .filter((r) => r.astronautId === astronautId && r.metric === metric)
      .sort((a, b) => a.missionDay - b.missionDay);

    const baseline = records.filter((r) => r.phase === "preflight").at(-1);
    if (!baseline) {
      metrics[metric] = { status: "insufficient_data", reason: "missing_preflight_baseline" };
      continue;
    }

    // Ignore older baseline scans for this particular trajectory.
    const series = [
      baseline,
      ...records.filter((r) =>
        r.phase !== "preflight" && r.missionDay > baseline.missionDay
      )
    ].sort((a, b) => a.missionDay - b.missionDay);

    if (series.length < 3) {
      metrics[metric] = {
        status: "insufficient_data",
        reason: "need_baseline_and_two_followups",
        sampleCount: series.length
      };
      continue;
    }

    const invalid = series.some((r) =>
      !Number.isFinite(r.value) || r.value < 0 ||
      !Number.isInteger(r.missionDay) ||
      !Number.isFinite(Date.parse(r.collectedAt)) ||
      r.unit !== baseline.unit ||
      r.collectionMethod !== baseline.collectionMethod ||
      r.sampleType !== baseline.sampleType ||
      r.source !== baseline.source
    );

    if (invalid || baseline.value <= 0) {
      metrics[metric] = { status: "incompatible_data", reason: "invalid_or_mismatched_measurements" };
      continue;
    }

    const duplicateDays = series.some(
      (r, i) => i > 0 && r.missionDay === series[i - 1].missionDay
    );
    if (duplicateDays) {
      metrics[metric] = { status: "needs_review", reason: "multiple_measurements_same_mission_day" };
      continue;
    }

    const latest = series.at(-1);
    const slopePerDay = observedSlopePerDay(series);
    const gaps = [];
    for (let i = 1; i < series.length; i += 1) {
      const daysBetween = series[i].missionDay - series[i - 1].missionDay;
      if (daysBetween > expectedIntervalDays * 1.5) {
        gaps.push({
          fromDay: series[i - 1].missionDay,
          toDay: series[i].missionDay,
          daysBetween
        });
      }
    }

    metrics[metric] = {
      status: "analyzed",
      unit: baseline.unit,
      sampleCount: series.length,
      baseline: baseline.value,
      latest: latest.value,
      latestMissionDay: latest.missionDay,
      changePercentFromBaseline: round(
        ((latest.value - baseline.value) / baseline.value) * 100
      ),
      observedSlopePer30Days: round(slopePerDay * 30, 4),
      direction: slopePerDay > 0 ? "increasing" : slopePerDay < 0 ? "decreasing" : "unchanged",
      samplingGaps: gaps,
      points: series.map((r) => ({
        missionDay: r.missionDay,
        value: r.value,
        phase: r.phase,
        collectedAt: r.collectedAt
      }))
    };
  }

  return {
    astronautId,
    analysisType: "bone_marker_trends",
    expectedIntervalDays,
    metrics,
    boneDensityLossPercent: null,
    clinicalRisk: "not_assessed",
    note: "Descriptive trends from observed or simulated biomarkers only. No spinal BMD or clinical risk is inferred."
  };
}
