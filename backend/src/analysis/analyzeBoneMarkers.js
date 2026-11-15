
import {
  metricDefinitions
} from "../mockApi/mockData.js";

export function analyzeBoneMarkers(
  readings,
  astronautId
) {
  const metrics = {};

  for (const metric of Object.keys(metricDefinitions)) {
    const records = readings
      .filter(r =>
        r.astronautId === astronautId &&
        r.metric === metric
      )
      .sort((a, b) =>
        a.missionDay - b.missionDay ||
        Date.parse(a.collectedAt) -
          Date.parse(b.collectedAt)
      );

    const baseline = records
      .filter(r => r.phase === "preflight")
      .at(-1);

    const latest = records
      .filter(r => r.phase !== "preflight")
      .at(-1);

    if (!baseline || !latest) {
      metrics[metric] = {
        status: "insufficient_data",
        changePercent: null
      };
      continue;
    }

    const comparable =
      Number.isFinite(baseline.value) &&
      Number.isFinite(latest.value) &&
      baseline.value > 0 &&
      latest.value >= 0 &&
      baseline.unit === latest.unit &&
      baseline.collectionMethod ===
        latest.collectionMethod &&
      baseline.sampleType === latest.sampleType &&
      latest.missionDay > baseline.missionDay &&
      Number.isFinite(Date.parse(
        baseline.collectedAt
      )) &&
      Number.isFinite(Date.parse(
        latest.collectedAt
      ));

    if (!comparable) {
      metrics[metric] = {
        status: "incompatible_data",
        changePercent: null
      };
      continue;
    }

    const changePercent =
      ((latest.value - baseline.value) /
        baseline.value) * 100;

    metrics[metric] = {
      status: "analyzed",
      baseline: baseline.value,
      latest: latest.value,
      unit: latest.unit,
      baselineMissionDay: baseline.missionDay,
      missionDay: latest.missionDay,
      changePercent:
        Number(changePercent.toFixed(2)),
      trend:
        changePercent > 0
          ? "increasing"
          : changePercent < 0
            ? "decreasing"
            : "unchanged",
      sampleCount: records.length
    };
  }

  return {
    astronautId,
    analysisType: "bone_remodeling",
    source: "simulated",
    metrics,
    boneDensityLossPercent: null,
    clinicalRisk: "not_assessed",
    note:
      "Descriptive biomarker changes only. " +
      "These do not measure spinal bone density " +
      "or diagnose bone loss."
  };
}
