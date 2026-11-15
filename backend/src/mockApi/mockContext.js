// DEMO DATA ONLY. These are fictional observations, not NASA astronaut records.
export const mockSymptoms = [
  { astronautId: "AST-001", missionDay: 15, backPainSeverity: 1, postureChange: false, source: "simulated" },
  { astronautId: "AST-001", missionDay: 30, backPainSeverity: 2, postureChange: false, source: "simulated" },
  { astronautId: "AST-001", missionDay: 60, backPainSeverity: 3, postureChange: true, source: "simulated" },
  { astronautId: "AST-001", missionDay: 90, backPainSeverity: 4, postureChange: true, source: "simulated" }
];

export const mockExercise = [
  { astronautId: "AST-001", missionDay: 15, type: "resistive", plannedMinutes: 60, completedMinutes: 60, source: "simulated" },
  { astronautId: "AST-001", missionDay: 30, type: "resistive", plannedMinutes: 60, completedMinutes: 50, source: "simulated" },
  { astronautId: "AST-001", missionDay: 60, type: "resistive", plannedMinutes: 60, completedMinutes: 40, source: "simulated" },
  { astronautId: "AST-001", missionDay: 90, type: "resistive", plannedMinutes: 60, completedMinutes: 30, source: "simulated" }
];
