// Tamper-evident audit trail (pure functions).
// Each entry stores the hash of the previous entry; its own hash covers its content
// plus that previous hash. Editing, deleting or reordering any entry breaks the chain
// from that point on, and verifyChain() reports exactly where.
import { sha256 } from './sha256.js';

export const GENESIS = '0'.repeat(64);

// Stable JSON (sorted keys) so the same content always gives the same hash.
export function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

const body = (e) => ({ seq: e.seq, ts: e.ts, missionDay: e.missionDay, crewId: e.crewId, actor: e.actor, type: e.type, detail: e.detail, prevHash: e.prevHash });
export const hashEntry = (e) => sha256(canonical(body(e)));

export function makeEntry(chain, { ts = new Date().toISOString(), missionDay, crewId, actor, type, detail = {} }) {
  const prev = chain[chain.length - 1];
  const entry = { seq: prev ? prev.seq + 1 : 1, ts, missionDay, crewId, actor, type, detail, prevHash: prev ? prev.hash : GENESIS };
  return { ...entry, hash: hashEntry(entry) };
}

export function verifyChain(chain) {
  let prevHash = GENESIS;
  for (let i = 0; i < chain.length; i++) {
    const e = chain[i];
    if (e.seq !== i + 1) return { ok: false, brokenAt: i, seq: e.seq, reason: `entry #${i + 1} is missing or out of order` };
    if (e.prevHash !== prevHash) return { ok: false, brokenAt: i, seq: e.seq, reason: `entry #${e.seq} does not link to the entry before it` };
    if (hashEntry(e) !== e.hash) return { ok: false, brokenAt: i, seq: e.seq, reason: `entry #${e.seq} was changed after it was written` };
    prevHash = e.hash;
  }
  return { ok: true, count: chain.length, head: prevHash };
}

// Human-readable labels for the log
export const TYPES = {
  DATA_LOADED: 'Mission data loaded',
  TABLET_USER_CHANGED: 'Tablet user changed',
  READING_SAVED: 'Reading saved',
  REMEASURE_PROMPTED: 'Re-measure asked',
  READING_REPLACED: 'Reading replaced after re-measure',
  READING_KEPT: 'Reading kept against advice',
  ENGINE_DECISION: 'Engine decision',
  CHECKIN_COMPLETED: 'Check-in completed',
  WATCHDOG_ALERT: 'Watchdog Red Alert',
  TRIAGE_STEP: 'Triage step',
  CMO_CALLED: 'Crew medical officer called',
  REPORT_QUEUED: 'Report queued for flight surgeon',
  ALERT_EXITED: 'Alert screen closed',
};
