// DEMONSTRATION FIXTURES ONLY. None of these records are NASA observations.
export const metricDefinitions = {
  serum_ctx: {
    unit: "ng/mL",
    sampleType: "blood",
    collectionMethod: "morning_fasting_serum"
  },
  serum_p1np: {
    unit: "ug/L",
    sampleType: "blood",
    collectionMethod: "serum_sample"
  },
  urine_calcium_24h: {
    unit: "mg/24h",
    sampleType: "urine",
    collectionMethod: "24_hour_urine_collection"
  }
};

// Dates correspond to mission day 0 on 2026-01-08.
// Keep IDs CTX-002 / P1NP-002 / CAL-002 at Day 90 for existing tests.
const observations = [
  { missionDay: -7, phase: "preflight", collectedAt: "2026-01-01T08:00:00Z", values: { serum_ctx: 0.30, serum_p1np: 50, urine_calcium_24h: 160 } },
  { missionDay: 15, phase: "inflight", collectedAt: "2026-01-23T08:00:00Z", values: { serum_ctx: 0.32, serum_p1np: 49, urine_calcium_24h: 175 } },
  { missionDay: 30, phase: "inflight", collectedAt: "2026-02-07T08:00:00Z", values: { serum_ctx: 0.35, serum_p1np: 48, urine_calcium_24h: 190 } },
  { missionDay: 60, phase: "inflight", collectedAt: "2026-03-09T08:00:00Z", values: { serum_ctx: 0.38, serum_p1np: 47, urine_calcium_24h: 215 } },
  { missionDay: 90, phase: "inflight", collectedAt: "2026-04-08T08:00:00Z", values: { serum_ctx: 0.42, serum_p1np: 45, urine_calcium_24h: 250 } }
];

const prefixes = { serum_ctx: "CTX", serum_p1np: "P1NP", urine_calcium_24h: "CAL" };

export const mockReadings = observations.flatMap((observation) =>
  Object.entries(observation.values).map(([metric, value]) => ({
    // The original identifiers are preserved for backwards compatibility.
    id: `${prefixes[metric]}-${observation.missionDay === -7 ? "001" : observation.missionDay === 90 ? "002" : `D${observation.missionDay}`}`,
    astronautId: "AST-001",
    metric,
    value,
    missionDay: observation.missionDay,
    phase: observation.phase,
    collectedAt: observation.collectedAt,
    ...metricDefinitions[metric],
    source: "simulated"
  }))
);
