// What the app tracks and how to read each value from a daily.json row.
// `minSd` = smallest spread we trust (units of the indicator).
// `earthRef` = textbook Earth line shown on charts for comparison only.

export const INDICATORS = [
  { id: 'bp', label: 'Blood pressure', unit: 'mmHg', ruleId: 'bp', field: 'bp_sys', minSd: 3,
    format: (r) => `${r.bp_sys}/${r.bp_dia}`, earthRef: 120, earthLabel: 'Earth textbook limit 120', body: 'heart' },
  { id: 'hr', label: 'Heart rate', unit: 'bpm', ruleId: 'hr_rest', field: 'hr_rest', minSd: 2,
    format: (r) => `${r.hr_rest}`, body: 'heart' },
  { id: 'sleep', label: 'Sleep', unit: 'h', ruleId: 'sleep', field: 'sleep_h', minSd: 0.3, watchBelow: 6,
    format: (r) => r.sleep_h.toFixed(1), body: 'brain' },
  { id: 'mood', label: 'Mood & stress', unit: '/ 5', ruleId: 'mood', field: 'mood', minSd: 0.5,
    format: (r) => `${r.mood}`, body: 'brain' },
  { id: 'glucose', label: 'Blood sugar', unit: 'mg/dL', ruleId: 'glucose', field: 'glucose', minSd: 3,
    format: (r) => `${r.glucose}`, body: 'immune' },
  { id: 'temp', label: 'Temperature', unit: '°C', ruleId: 'temp', field: 'temp', minSd: 0.1,
    format: (r) => r.temp.toFixed(1), body: 'immune' },
  { id: 'bone', label: 'Bone loading', unit: '/ 150 min', ruleId: 'bone', field: 'ex_resist_min', minSd: 1,
    body: 'bones' },
  { id: 'radiation', label: 'Radiation dose', unit: 'mSv', ruleId: 'radiation', field: null, minSd: 0, body: 'cells' },
];

export const byId = Object.fromEntries(INDICATORS.map((i) => [i.id, i]));
