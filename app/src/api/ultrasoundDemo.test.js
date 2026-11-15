import { describe, it, expect, beforeEach } from 'vitest';
import { analyzeUltrasoundDemo, resetUltrasoundDemo, ultrasoundTrend } from './ultrasoundDemo.js';

const good = { sha256: 'a'.repeat(64), width: 640, height: 480, brightness: 60, contrast: 40, sharpness: 6 };

beforeEach(() => resetUltrasoundDemo());

describe('ultrasoundDemo', () => {
  it('shows the static trend before any scan', () => {
    const trend = ultrasoundTrend('chris');
    expect(trend.status).toBe('analyzed');
    expect(trend.points.map((p) => p.missionDay)).toEqual([-7, 30, 60, 90]);
    expect(trend.baseline.lumbarBmd).toBe(1.045);
  });

  it('gives a labelled simulated estimate and adds it to the trend', () => {
    const r = analyzeUltrasoundDemo({ crewId: 'chris', missionDay: 140, image: good });
    expect(r.status).toBe('estimated');
    expect(r.concept).toBe(true);
    expect(r.label).toMatch(/not a bone density measurement/);
    expect(r.regions).toHaveLength(4);
    expect(r.estimate.low).toBeLessThan(r.estimate.lumbarBmd);
    expect(r.estimate.lumbarBmd).toBeLessThan(r.estimate.high);
    expect(r.comparison.previous.missionDay).toBe(90);
    expect(r.comparison.baseline.missionDay).toBe(-7);
    expect(ultrasoundTrend('chris').points.at(-1).missionDay).toBe(140);
  });

  it('repeats the same estimate for the same image', () => {
    const a = analyzeUltrasoundDemo({ crewId: 'chris', missionDay: 140, image: good });
    const b = analyzeUltrasoundDemo({ crewId: 'chris', missionDay: 140, image: good });
    expect(a.estimate.lumbarBmd).toBe(b.estimate.lumbarBmd);
    expect(ultrasoundTrend('chris').points.filter((p) => p.missionDay === 140)).toHaveLength(1);
  });

  it('asks for a re-scan when the picture is poor', () => {
    const r = analyzeUltrasoundDemo({ crewId: 'chris', missionDay: 140, image: { ...good, sha256: 'b'.repeat(64), brightness: 5, sharpness: 0.5 } });
    expect(r.status).toBe('rescan_needed');
    expect(r.estimate).toBeNull();
    expect(r.quality.issues.length).toBeGreaterThanOrEqual(2);
    expect(ultrasoundTrend('chris').points.map((p) => p.missionDay)).toEqual([-7, 30, 60, 90]);
  });
});
