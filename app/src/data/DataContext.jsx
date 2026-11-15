// Loads the mission data once (from /public/data, bundled with the app = works offline)
// and holds app-wide state: who is using the tablet, which mission day it is,
// readings entered during today's check-in, and the tamper-evident audit trail.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { rowsFor } from '../engine/engine.js';
import { makeEntry, canonical } from '../audit/audit.js';
import { sha256 } from '../audit/sha256.js';

const FILES = ['crew', 'daily', 'environment', 'stream_emergency', 'rules', 'triage', 'events', 'spine'];
const NASA = ['dxa_bedrest_summary', 'dxa_screening_reference', 'c3_bedrest_summary', 'spine_bedrest_phases'];
const DataCtx = createContext(null);
const base = import.meta.env.BASE_URL;
const CHECKIN_KEY = 'astropulse.checkin';
const AUDIT_KEY = 'astropulse.audit';

const readStore = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const writeStore = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage may be blocked */ } };

export function DataProvider({ children }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [crewId, setCrewIdState] = useState('maya');
  const [today] = useState(140); // the demo story is mission day 140
  const [checkin, setCheckin] = useState(() => readStore(CHECKIN_KEY, {}));
  const [audit, setAudit] = useState(() => readStore(AUDIT_KEY, []));
  const loggedLoad = useRef(false);

  useEffect(() => { writeStore(CHECKIN_KEY, checkin); }, [checkin]);
  useEffect(() => { writeStore(AUDIT_KEY, audit); }, [audit]);

  // Append one entry to the hash chain. `actor` defaults to the tablet user.
  const crewName = data?.crew.find((c) => c.id === crewId)?.name;
  const log = useCallback((type, detail = {}, actor) => {
    const ts = new Date().toISOString();
    setAudit((prev) => [...prev, makeEntry(prev, { ts, missionDay: today, crewId, actor: actor || crewName || crewId, type, detail })]);
  }, [today, crewId, crewName]);

  useEffect(() => {
    const get = (p) => fetch(`${base}data/${p}.json`).then((r) => { if (!r.ok) throw new Error(p); return r.json(); });
    Promise.all([...FILES.map(get), ...NASA.map((n) => get(`nasa/${n}`))])
      .then((all) => {
        const d = Object.fromEntries(FILES.map((f, i) => [f, all[i]]));
        d.nasa = Object.fromEntries(NASA.map((n, i) => [n, all[FILES.length + i]]));
        d.fingerprint = sha256(canonical(d.daily)).slice(0, 16); // which dataset this session ran on
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, []);

  // Record which dataset the app started with (once per fresh log).
  useEffect(() => {
    if (!data || loggedLoad.current) return;
    loggedLoad.current = true;
    if (audit.length === 0) log('DATA_LOADED', { files: FILES.length + NASA.length, daily_rows: data.daily.length, dataset_fingerprint: data.fingerprint }, 'AstroPulse system');
  }, [data, audit.length, log]);

  const saveReading = useCallback((key, value) => {
    setCheckin((prev) => ({ ...prev, [key]: { ...value, savedAt: new Date().toISOString() } }));
    const { savedAt, ...clean } = value; // eslint-disable-line no-unused-vars
    log('READING_SAVED', { reading: key, ...clean });
  }, [log]);

  const setCrewId = useCallback((id) => {
    if (id === crewId) return;
    log('TABLET_USER_CHANGED', { from: crewId, to: id }, 'AstroPulse system');
    setCrewIdState(id);
    setCheckin({});
  }, [crewId, log]);

  const resetCheckin = () => setCheckin({});
  const replaceAudit = (next) => setAudit(next); // used only by the tamper demo / reset on the Audit page

  const value = useMemo(() => {
    if (!data) return null;
    const crew = data.crew.find((c) => c.id === crewId);
    // Readings entered in today's check-in replace the simulated values for today.
    const c = checkin;
    const rows = rowsFor(data.daily, crewId).map((r) => (r.day !== today ? r : {
      ...r,
      ...(c.bp && { bp_sys: c.bp.sys, bp_dia: c.bp.dia }),
      ...(c.hr && { hr_rest: c.hr.value }),
      ...(c.temp && { temp: c.temp.value }),
      ...(c.glucose && { glucose: c.glucose.value }),
      ...(c.sleep && { sleep_h: c.sleep.value }),
      ...(c.mood && { mood: c.mood.mood, stress: c.mood.stress, symptoms: c.mood.symptoms }),
    }));
    return { ...data, crew, crewList: data.crew, crewId, setCrewId, today, rows, checkin, saveReading, resetCheckin, audit, log, replaceAudit };
  }, [data, crewId, setCrewId, today, checkin, saveReading, audit, log]);

  if (error) return <div className="center-msg">Could not load mission data ({error}). Run the data scripts and copy data/*.json into app/public/data.</div>;
  if (!value) return <div className="center-msg">Loading mission data…</div>;
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

export const useData = () => useContext(DataCtx);
