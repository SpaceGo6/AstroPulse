
import test from "node:test";
import assert from "node:assert/strict";

import { mockReadings } from "../mockApi/mockData.js";
import { analyzeBoneMarkers } from "./analyzeBoneMarkers.js";

// Test 1: Verify percentage-change calculations
test("computes the three simulated baseline changes", () => {
  const result = analyzeBoneMarkers(mockReadings, "AST-001");

  assert.equal(
    result.metrics.serum_ctx.changePercent,
    40
  );

  assert.equal(
    result.metrics.serum_p1np.changePercent,
    -10
  );

  assert.equal(
    result.metrics.urine_calcium_24h.changePercent,
    56.25
  );

  // Biomarkers cannot directly measure spinal BMD loss
  assert.equal(result.boneDensityLossPercent, null);
});

// Test 2: Handle missing baseline measurements
test("returns insufficient data rather than inventing a baseline", () => {
  const readingsWithoutBaseline = mockReadings.filter(
    (reading) => reading.phase !== "preflight"
  );

  const result = analyzeBoneMarkers(
    readingsWithoutBaseline,
    "AST-001"
  );

  assert.equal(
    result.metrics.serum_ctx.status,
    "insufficient_data"
  );
});

// Test 3: Reject incompatible measurement units
test("refuses incompatible units", () => {
  const readings = mockReadings.map(
    (reading) => ({ ...reading })
  );

  const ctxReading = readings.find(
    (reading) => reading.id === "CTX-002"
  );

  ctxReading.unit = "pg/mL";

  const result = analyzeBoneMarkers(
    readings,
    "AST-001"
  );

  assert.equal(
    result.metrics.serum_ctx.status,
    "incompatible_data"
  );
});
