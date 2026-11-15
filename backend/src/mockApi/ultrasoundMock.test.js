import test from "node:test";
import assert from "node:assert/strict";
import { analyzeUltrasound, checkQuality, ultrasoundHistory } from "./ultrasoundMock.js";

const good = { sha256: "a".repeat(64), width: 640, height: 480, brightness: 60, contrast: 40, sharpness: 6 };

test("good image gives a labelled, simulated estimate and is added to history", () => {
  const before = ultrasoundHistory.length;
  const r = analyzeUltrasound({ astronautId: "AST-001", missionDay: 120, image: good });
  assert.equal(r.status, "estimated");
  assert.equal(r.concept, true);
  assert.equal(r.source, "simulated");
  assert.match(r.label, /not a bone density measurement/);
  assert.equal(r.regions.length, 4);
  assert.ok(r.estimate.low < r.estimate.lumbarBmd && r.estimate.lumbarBmd < r.estimate.high);
  assert.equal(r.comparison.previous.missionDay, 90);
  assert.equal(r.comparison.baseline.missionDay, -7);
  assert.equal(ultrasoundHistory.length, before + 1);
});

test("same image again gives the same answer and does not duplicate history", () => {
  const n = ultrasoundHistory.length;
  const a = analyzeUltrasound({ astronautId: "AST-001", missionDay: 120, image: good });
  const b = analyzeUltrasound({ astronautId: "AST-001", missionDay: 120, image: good });
  assert.equal(a.estimate.lumbarBmd, b.estimate.lumbarBmd);
  assert.equal(ultrasoundHistory.length, n);
});

test("poor image asks for a re-scan and gives no estimate", () => {
  const r = analyzeUltrasound({ astronautId: "AST-001", missionDay: 121, image: { ...good, sha256: "b".repeat(64), brightness: 5, sharpness: 0.5 } });
  assert.equal(r.status, "rescan_needed");
  assert.equal(r.estimate, null);
  assert.ok(r.quality.issues.length >= 2);
});

test("missing statistics are unreadable", () => {
  assert.equal(checkQuality({ sha256: "x" }).verdict, "unreadable");
});
