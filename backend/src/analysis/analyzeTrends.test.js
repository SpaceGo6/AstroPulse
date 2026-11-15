import test from "node:test";
import assert from "node:assert/strict";
import { mockReadings } from "../mockApi/mockData.js";
import { analyzeTrends } from "./analyzeTrends.js";

test("calculates five-point observed trends", () => {
  const result = analyzeTrends(mockReadings, "AST-001");
  assert.equal(result.metrics.serum_ctx.status, "analyzed");
  assert.equal(result.metrics.serum_ctx.sampleCount, 5);
  assert.equal(result.metrics.serum_ctx.changePercentFromBaseline, 40);
  assert.equal(result.metrics.serum_ctx.direction, "increasing");
  assert.equal(result.metrics.serum_p1np.changePercentFromBaseline, -10);
  assert.equal(result.metrics.serum_p1np.direction, "decreasing");
  assert.equal(result.metrics.urine_calcium_24h.changePercentFromBaseline, 56.25);
  assert.equal(result.boneDensityLossPercent, null);
  assert.deepEqual(result.metrics.serum_ctx.samplingGaps, []);
});

test("reports insufficient data without preflight baseline", () => {
  const input = mockReadings.filter((r) => r.phase !== "preflight");
  const result = analyzeTrends(input, "AST-001");
  assert.equal(result.metrics.serum_ctx.status, "insufficient_data");
  assert.equal(result.metrics.serum_ctx.reason, "missing_preflight_baseline");
});

test("rejects incompatible units", () => {
  const input = mockReadings.map((r) => ({ ...r }));
  input.find((r) => r.id === "CTX-002").unit = "pg/mL";
  const result = analyzeTrends(input, "AST-001");
  assert.equal(result.metrics.serum_ctx.status, "incompatible_data");
});

test("flags a long sampling gap without inventing values", () => {
  const input = mockReadings.filter(
    (r) => r.metric !== "serum_ctx" || [-7, 15, 90].includes(r.missionDay)
  );
  const result = analyzeTrends(input, "AST-001", 30);
  assert.deepEqual(result.metrics.serum_ctx.samplingGaps, [
    { fromDay: 15, toDay: 90, daysBetween: 75 }
  ]);
  assert.equal(result.metrics.serum_ctx.points.length, 3);
});

test("does not silently average duplicate measurements", () => {
  const input = [...mockReadings, { ...mockReadings.find((r) => r.id === "CTX-D30"), id: "CTX-D30B" }];
  const result = analyzeTrends(input, "AST-001");
  assert.equal(result.metrics.serum_ctx.status, "needs_review");
});
