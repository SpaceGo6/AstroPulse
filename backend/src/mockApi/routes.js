
import { Router } from "express";
import { randomUUID } from "node:crypto";

import {
  metricDefinitions,
  mockReadings
} from "./mockData.js";

const router = Router();

// List available biomarkers
router.get("/metrics", (req, res) => {
  res.json({
    source: "simulated",
    metrics: metricDefinitions
  });
});

// Get astronaut readings
router.get(
  "/astronauts/:astronautId/readings",
  (req, res) => {
    const { astronautId } = req.params;
    const { metric } = req.query;

    if (
      metric !== undefined &&
      (
        typeof metric !== "string" ||
        !metricDefinitions[metric]
      )
    ) {
      return res.status(400).json({
        error: "Unknown metric"
      });
    }

    const readings = mockReadings
      .filter(r =>
        r.astronautId === astronautId &&
        (!metric || r.metric === metric)
      )
      .sort((a, b) =>
        a.missionDay - b.missionDay ||
        Date.parse(a.collectedAt) -
          Date.parse(b.collectedAt)
      );

    res.json({
      astronautId,
      source: "simulated",
      count: readings.length,
      readings
    });
  }
);

// Add a simulated measurement
router.post(
  "/astronauts/:astronautId/readings",
  (req, res) => {
    const { astronautId } = req.params;

    const {
      metric,
      value,
      missionDay,
      phase,
      collectedAt
    } = req.body ?? {};

    const definition = metricDefinitions[metric];

    const validPhase = [
      "preflight",
      "inflight",
      "postflight"
    ].includes(phase);

    if (
      !definition ||
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      !Number.isInteger(missionDay) ||
      !validPhase ||
      typeof collectedAt !== "string" ||
      !Number.isFinite(Date.parse(collectedAt))
    ) {
      return res.status(400).json({
        error: "Invalid measurement data"
      });
    }

    const reading = {
      id: randomUUID(),
      astronautId,
      metric,
      value,
      missionDay,
      phase,
      collectedAt:
        new Date(collectedAt).toISOString(),
      ...definition,
      source: "simulated"
    };

    mockReadings.push(reading);

    res.status(201).json(reading);
  }
);

export default router;
