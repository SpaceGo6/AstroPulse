// Run: npm test   (checks the engine against the generated mission data)
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { rowsFor, indicatorStatus, needsRemeasure, watchdog, boneForecast } from './engine.js';

const load = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/data', f), 'utf8'));
const daily = load('daily.json');
const env = load('environment.json');
const rules = load('rules.json');
const stream = load('stream_emergency.json');
const chris = rowsFor(daily, 'chris');
const sam = rowsFor(daily, 'sam');

describe('Chris, day 140', () => {
  it('blood pressure is Watch (above their space baseline 3 days)', () => {
    expect(indicatorStatus('bp', chris, 140, rules, env).status).toBe('watch');
  });
  it('the slipped-cuff reading 168 asks for a re-measure', () => {
    expect(needsRemeasure(chris, 'bp_sys', 140, 168).remeasure).toBe(true);
  });
  it('a reading back toward normal (123) does not ask for a re-measure', () => {
    expect(needsRemeasure(chris, 'bp_sys', 140, 123).remeasure).toBe(false);
  });
  it('the confirmed reading 148 does not', () => {
    expect(needsRemeasure(chris, 'bp_sys', 140, 148).remeasure).toBe(false);
  });
  it('bone forecast at landing is past the watch level', () => {
    const f = boneForecast(chris, 140, rules);
    expect(f.status).toBe('watch');
    expect(f.landingOnTarget).toBeGreaterThan(f.landingCurrent);
  });
  it('sleep is Watch (under 6 h for 3 nights)', () => {
    expect(indicatorStatus('sleep', chris, 140, rules, env).status).toBe('watch');
  });
  it('temperature and blood sugar stay Normal', () => {
    expect(indicatorStatus('temp', chris, 140, rules, env).status).toBe('normal');
    expect(indicatorStatus('glucose', chris, 140, rules, env).status).toBe('normal');
  });
});

describe('Sam, day 140 (healthy control)', () => {
  it('blood pressure is Normal', () => {
    expect(indicatorStatus('bp', sam, 140, rules, env).status).toBe('normal');
  });
});

describe('Watchdog on Leo\'s feed', () => {
  it('fires at minute 75', () => {
    expect(watchdog(stream.rows).minute).toBe(75);
  });
});
