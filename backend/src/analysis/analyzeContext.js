/** Descriptive summaries of reported symptoms and recorded exercise sessions. */
export function analyzeContext(symptoms, exercise, astronautId) {
  const symptomsForAstronaut = symptoms.filter(r => r.astronautId === astronautId);
  const exerciseForAstronaut = exercise.filter(r => r.astronautId === astronautId);

  const validSymptoms = symptomsForAstronaut
    .filter(r =>
      Number.isInteger(r.missionDay) &&
      Number.isInteger(r.backPainSeverity) &&
      r.backPainSeverity >= 0 && r.backPainSeverity <= 10 &&
      typeof r.postureChange === "boolean"
    )
    .sort((a, b) => a.missionDay - b.missionDay);

  const validExercise = exerciseForAstronaut
    .filter(r =>
      Number.isInteger(r.missionDay) &&
      Number.isFinite(r.plannedMinutes) && r.plannedMinutes > 0 &&
      Number.isFinite(r.completedMinutes) &&
      r.completedMinutes >= 0 && r.completedMinutes <= r.plannedMinutes
    );

  const totalPlannedMinutes = validExercise.reduce((sum, r) => sum + r.plannedMinutes, 0);
  const totalCompletedMinutes = validExercise.reduce((sum, r) => sum + r.completedMinutes, 0);
  const adherencePercent = totalPlannedMinutes > 0
    ? Number((totalCompletedMinutes / totalPlannedMinutes * 100).toFixed(2))
    : null;

  const latestSymptom = validSymptoms.at(-1) ?? null;
  const observations = [];
  if (latestSymptom) {
    observations.push(`Latest reported back pain: ${latestSymptom.backPainSeverity}/10`);
    if (latestSymptom.postureChange) observations.push("Posture change reported");
  }
  if (adherencePercent !== null) {
    observations.push(`Recorded exercise-minute adherence: ${adherencePercent}%`);
  }

  return {
    astronautId,
    symptoms: {
      latest: latestSymptom,
      recordCount: validSymptoms.length,
      invalidRecordCount: symptomsForAstronaut.length - validSymptoms.length
    },
    exercise: {
      adherencePercent,
      totalPlannedMinutes,
      totalCompletedMinutes,
      recordCount: validExercise.length,
      invalidRecordCount: exerciseForAstronaut.length - validExercise.length
    },
    observations,
    clinicalRisk: "not_assessed",
    note: "Exercise adherence describes only the recorded sessions, not an entire mission. Symptoms are self-reported."
  };
}
