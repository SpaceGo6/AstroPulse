import test from "node:test";
import assert from "node:assert/strict";
import { mockReadings } from "../mockApi/mockData.js";
import { mockSymptoms, mockExercise } from "../mockApi/mockContext.js";
import { analyzeBoneHealth } from "./analyzeBoneHealth.js";

const makeReport = (overrides = {}) => analyzeBoneHealth({
  astronautId: "AST-001",
  readings: mockReadings,
  symptoms: mockSymptoms,
  exercise: mockExercise,
  ...overrides
});

test("combines biomarker, trend, symptom, and exercise analyses", () => {
  const report = makeReport();
  assert.equal(report.boneMarkers.metrics.serum_ctx.changePercent, 40);
  assert.equal(report.biomarkerTrends.metrics.serum_ctx.status, "analyzed");
  assert.equal(report.context.symptoms.latest.backPainSeverity, 4);
  assert.equal(report.context.exercise.adherencePercent, 75);
  assert.equal(report.latestMissionDay, 90);
  assert.equal(report.dataSource, "simulated");
});

test("does not invent a BMD or clinical risk estimate", () => {
  const report = makeReport();
  assert.equal(report.assessment.measuredSpinalBmdChangePercent, null);
  assert.equal(report.assessment.predictedSpinalBmd, null);
  assert.equal(report.assessment.clinicalRisk, "not_assessed");
  assert.deepEqual(report.assessment.medicalRecommendations, []);
});

test("reports absent symptom and exercise data", () => {
  const report = makeReport({ symptoms: [], exercise: [] });
  assert.equal(report.context.exercise.adherencePercent, null);
  assert.ok(report.assessment.missingData.some(r => r.startsWith("symptoms:")));
  assert.ok(report.assessment.missingData.some(r => r.startsWith("exercise:")));
});

test("reports missing baseline and insufficient trajectories", () => {
  const report = makeReport({ readings: mockReadings.filter(r => r.phase !== "preflight") });
  assert.equal(report.boneMarkers.metrics.serum_ctx.status, "insufficient_data");
  assert.equal(report.biomarkerTrends.metrics.serum_ctx.status, "insufficient_data");
  assert.ok(report.assessment.missingData.some(r => r.startsWith("serum_ctx:")));
});

test("flags incompatible unit in trend data", () => {
  const readings = mockReadings.map(r => ({ ...r }));
  readings.find(r => r.id === "CTX-002").unit = "pg/mL";
  const report = makeReport({ readings });
  assert.equal(report.biomarkerTrends.metrics.serum_ctx.status, "incompatible_data");
  assert.ok(report.assessment.dataQualityFlags.some(r => r.startsWith("serum_ctx trend:")));
});

test("flags invalid symptom and exercise logs rather than using them", () => {
  const report = makeReport({
    symptoms: [...mockSymptoms, { astronautId: "AST-001", missionDay: 91, backPainSeverity: 20, postureChange: false }],
    exercise: [...mockExercise, { astronautId: "AST-001", missionDay: 91, plannedMinutes: 60, completedMinutes: 90 }]
  });
  assert.equal(report.context.symptoms.latest.missionDay, 90);
  assert.equal(report.context.exercise.adherencePercent, 75);
  assert.ok(report.assessment.dataQualityFlags.some(r => r.includes("invalid symptom")));
  assert.ok(report.assessment.dataQualityFlags.some(r => r.includes("invalid exercise")));
});

test("fails fast if astronaut ID is missing", () => {
  assert.throws(() => analyzeBoneHealth({ astronautId: "" }), /astronautId is required/);
});
