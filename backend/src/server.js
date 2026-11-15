import { pathToFileURL } from "node:url";
import express from "express";
import cors from "cors";
import mockRoutes from "./mockApi/routes.js";
import ultrasoundRoutes from "./mockApi/ultrasoundMock.js";
import { mockReadings } from "./mockApi/mockData.js";
import { analyzeBoneMarkers } from "./analysis/analyzeBoneMarkers.js";
import { analyzeTrends } from "./analysis/analyzeTrends.js";
import { mockSymptoms, mockExercise } from "./mockApi/mockContext.js";
import { analyzeBoneHealth } from "./analysis/analyzeBoneHealth.js";

const app = express();
const port = Number(process.env.PORT) || 3001;

// Frontend origins allowed to call the API. Override with CORS_ORIGINS="https://host,https://other".
const allowedOrigins = (process.env.CORS_ORIGINS ??
  "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,http://localhost:3000,https://astropulse-b5b55.web.app,https://astropulse-b5b55.firebaseapp.com")
  .split(",").map((o) => o.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", project: "AstroPulse", mode: "mock" });
});

app.use("/api/mock", mockRoutes);
// Concept demo: simulated AI reading of spine ultrasound images (see mockApi/ultrasoundMock.js).
app.use("/api/mock", ultrasoundRoutes);

app.get("/api/astronauts/:astronautId/analysis", (req, res) => {
  const { astronautId } = req.params;
  const readings = mockReadings.filter((r) => r.astronautId === astronautId);
  if (readings.length === 0) {
    return res.status(404).json({ error: "No readings for this astronaut" });
  }
  res.json(analyzeBoneMarkers(readings, astronautId));
});

// NEW: observed trends across preflight and multiple mission days.
app.get("/api/astronauts/:astronautId/trends", (req, res) => {
  const { astronautId } = req.params;
  const readings = mockReadings.filter((r) => r.astronautId === astronautId);
  if (readings.length === 0) {
    return res.status(404).json({ error: "No readings for this astronaut" });
  }
  res.json(analyzeTrends(readings, astronautId));
});

// NEW: One combined report for the Bone Health dashboard.
app.get("/api/astronauts/:astronautId/bone-health", (req, res) => {
  const { astronautId } = req.params;
  const hasData = [mockReadings, mockSymptoms, mockExercise]
    .some(records => records.some(r => r.astronautId === astronautId));
  if (!hasData) return res.status(404).json({ error: "Astronaut not found" });

  res.json(analyzeBoneHealth({
    astronautId,
    readings: mockReadings,
    symptoms: mockSymptoms,
    exercise: mockExercise
  }));
});

// Vercel imports this file and serves the exported app. Listen only when run directly (`npm run dev`).
export default app;

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entry) {
  app.listen(port, () => console.log(`AstroPulse API running at http://localhost:${port}`));
}
