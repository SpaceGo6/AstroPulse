import { describe, it, expect } from 'vitest';
import { sha256 } from './sha256.js';
import { makeEntry, verifyChain } from './audit.js';

describe('sha256', () => {
  it('matches the standard test vectors', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('audit chain', () => {
  const build = () => {
    let c = [];
    c = [...c, makeEntry(c, { missionDay: 140, crewId: 'chris', actor: 'Chris', type: 'READING_SAVED', detail: { bp: '148/95' } })];
    c = [...c, makeEntry(c, { missionDay: 140, crewId: 'chris', actor: 'Engine', type: 'ENGINE_DECISION', detail: { bp: 'watch' } })];
    c = [...c, makeEntry(c, { missionDay: 152, crewId: 'leo', actor: 'Watchdog', type: 'WATCHDOG_ALERT', detail: { minute: 75 } })];
    return c;
  };
  it('verifies an untouched chain', () => {
    expect(verifyChain(build())).toMatchObject({ ok: true, count: 3 });
  });
  it('catches an edited value', () => {
    const c = build();
    c[0] = { ...c[0], detail: { bp: '120/80' } };
    expect(verifyChain(c)).toMatchObject({ ok: false, seq: 1 });
  });
  it('catches a deleted entry', () => {
    const c = build();
    c.splice(1, 1);
    expect(verifyChain(c).ok).toBe(false);
  });
});
