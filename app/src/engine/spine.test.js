// Run: npm test   (spine engine against the generated spine data)
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { rowsFor } from './engine.js';
import { spineForecast, spinePhases, spineAlerts, spineSignals, recoveryPct, downlinkPacket } from './spine.js';

const load = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/data', f), 'utf8'));
const daily = load('daily.json');
const spine = load('spine.json');
const crew = load('crew.json');
const T = 140;
const setup = (id) => {
  const rows = rowsFor(daily, id);
  const f = spineForecast(rows, spine.crew[id], spine.model, T, spine.landing_day);
  return { rows, f, ph: spinePhases(spine.crew[id], f, spine.model, T), alerts: spineAlerts({ rows, crewSpine: spine.crew[id], forecast: f, today: T }) };
};

describe('spine', () => {
  it('Chris: forecast past watch level at current pace, back under it on target', () => {
    const { f } = setup('chris');
    expect(f.status).toBe('watch');
    expect(f.landingTargetPct).toBeGreaterThan(f.landingCurrentPct);
  });
  it('Chris: several signals agree, so one pattern alert fires', () => {
    const { rows, f, alerts } = setup('chris');
    const on = spineSignals({ rows, crewSpine: spine.crew.chris, forecast: f, today: T }).filter((x) => x.on).map((x) => x.id);
    expect(on).toEqual(expect.arrayContaining(['exercise', 'ntx', 'scan', 'pain']));
    expect(alerts.map((a) => a.id)).toContain('pattern');
  });
  it('Chris: behind on exercise this week gets a nudge', () => {
    expect(setup('chris').alerts.map((a) => a.id)).toContain('week');
  });
  it('Leo: one high urine calcium alone is a signal, not an alert', () => {
    const { rows, f, alerts } = setup('leo');
    const on = spineSignals({ rows, crewSpine: spine.crew.leo, forecast: f, today: T }).filter((x) => x.on).map((x) => x.id);
    expect(on).toEqual(['urine_ca']);
    expect(alerts).toEqual([]);
  });
  it('phase averages: ground > in flight > post-flight at landing', () => {
    const { ph } = setup('chris');
    expect(ph.ground.avg).toBeGreaterThan(ph.flight.avg);
    expect(ph.post.points[0].bmd).toBeLessThan(ph.flight.avg);
    expect(ph.post.points[2].bmd).toBeGreaterThan(ph.post.points[0].bmd); // recovering
  });
  it('recovery never overshoots pre-flight', () => {
    expect(recoveryPct(-3, 10000, 276)).toBeLessThanOrEqual(0);
  });
  it('severe pain report raises Act first', () => {
    const { rows, f } = setup('leo');
    const a = spineAlerts({ rows, crewSpine: spine.crew.leo, forecast: f, today: T, reports: [{ pain: 8, where: 'low back' }] });
    expect(a[0].status).toBe('act');
  });
  it('downlink packet carries all three averages', () => {
    const { f, ph, alerts } = setup('chris');
    const p = downlinkPacket({ crew: crew[0], today: T, phases: ph, forecast: f, alerts, crewSpine: spine.crew.chris, reports: [] });
    expect(Object.keys(p.averages_g_cm2)).toHaveLength(3);
  });
});
