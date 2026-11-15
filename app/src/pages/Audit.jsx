// Audit trail. Two views:
//  - Daily records: one row per mission day, one column per reading, coloured by status,
//    marked "audited" when the day's readings are in the hash chain. Click a day for its events.
//  - Event log: the raw hash-chained entries (verify, export, tamper demo).
import { Fragment, useMemo, useState } from 'react';
import { useData } from '../data/DataContext.jsx';
import { verifyChain, TYPES, makeEntry } from '../audit/audit.js';
import { indicatorStatus } from '../engine/engine.js';
import { Icon, PageHeader, StatusChip } from '../components/ui.jsx';

const KIND = (t) => (t === 'WATCHDOG_ALERT' || t === 'CMO_CALLED' ? 'act' : t === 'REMEASURE_PROMPTED' || t === 'READING_KEPT' || t === 'ENGINE_DECISION' || t === 'SPINE_DOWNLINK' ? 'watch' : 'normal');
const COLORS = { act: 'var(--bad-text)', watch: 'var(--warn)', normal: 'var(--text)' };
const LABEL = { bp: 'Blood pressure', hr: 'Heart rate', temp: 'Temperature', glucose: 'Blood sugar', sleep: 'Sleep', mood: 'Mood & symptoms' };

// Plain-English one-liner for each event type.
function describe(e) {
  const d = e.detail || {};
  switch (e.type) {
    case 'READING_SAVED':
      if (d.reading === 'bp') return `Blood pressure ${d.sys}/${d.dia} mmHg`;
      if (d.reading === 'mood') return `Mood ${d.mood}/5, stress ${d.stress}/5${d.symptoms?.length ? `, symptoms: ${d.symptoms.join(', ')}` : ', no symptoms'}`;
      return `${LABEL[d.reading] || d.reading}: ${d.value}${{ hr: ' bpm', temp: ' °C', glucose: ' mg/dL', sleep: ' h' }[d.reading] || ''}`;
    case 'REMEASURE_PROMPTED': return `Reading ${d.entered} jumped ${d.jump_mmHg} mmHg (usual daily change ${d.usual_daily_change}); asked to re-measure`;
    case 'READING_REPLACED': return `${d.from} replaced by ${d.to}`;
    case 'READING_KEPT': return `${d.reading} kept without re-measuring`;
    case 'ENGINE_DECISION': return Object.entries(d).map(([k, v]) => `${k} ${v}`).join(' · ');
    case 'CHECKIN_COMPLETED': return `${d.readings_saved} of 6 readings saved`;
    case 'WATCHDOG_ALERT': return `${d.patient}: heart rate ${d.heart_rate}, SpO₂ ${d.spo2} at minute ${d.minute}`;
    case 'TRIAGE_STEP': return `${d.patient}: step ${d.step} ${d.done ? 'done' : 'un-ticked'}`;
    case 'CMO_CALLED': return `For ${d.patient} (HR ${d.heart_rate}, SpO₂ ${d.spo2})`;
    case 'REPORT_QUEUED': return `For ${d.patient}, sends at next downlink`;
    case 'ALERT_EXITED': return `${d.patient}: ${d.steps_done} steps done`;
    case 'SPINE_SYMPTOM': return `Back pain ${d.pain}/10 (${d.where})${d.hunched ? ', hunched posture' : ''}`;
    case 'IMAGING_ADDED': return `${d.test}: spine ${d.lumbar_bmd} g/cm² (${d.pct}% vs pre-flight)${d.status ? ` · ${d.status}` : ''}`;
    case 'ULTRASOUND_ANALYZED': return d.estimate != null ? `Image ${d.image}: simulated AI estimate ${d.estimate} g/cm² (concept demo)` : `Image ${d.image}: ${String(d.result).replace(/_/g, ' ')}`;
    case 'GROUND_NOTES_SAVED': return `Notes for the day ${d.report_day} report (${d.chars} characters)`;
    case 'SPINE_DOWNLINK': return `${d.alerts} alert(s), packet hash ${d.packet_hash}`;
    case 'TABLET_USER_CHANGED': return `${d.from} → ${d.to}`;
    case 'DATA_LOADED': return `${d.daily_rows} daily rows, fingerprint ${d.dataset_fingerprint}`;
    default: return Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(' · ');
  }
}

const COLS = [
  { id: 'bp', head: 'Blood pressure', unit: 'mmHg', show: (r) => `${r.bp_sys}/${r.bp_dia}` },
  { id: 'hr', head: 'Heart rate', unit: 'bpm', show: (r) => r.hr_rest },
  { id: 'temp', head: 'Temp', unit: '°C', show: (r) => r.temp.toFixed(1) },
  { id: 'glucose', head: 'Blood sugar', unit: 'mg/dL', show: (r) => r.glucose },
  { id: 'sleep', head: 'Sleep', unit: 'h', show: (r) => r.sleep_h.toFixed(1) },
  { id: 'mood', head: 'Mood / stress', unit: '/5', show: (r) => `${r.mood} / ${r.stress}` },
];
const cell = { padding: '10px 12px', borderBottom: '1px solid #1A2438', whiteSpace: 'nowrap' };
const th = { ...cell, color: 'var(--muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid var(--line)' };

function DailyRecords({ rows, today, rules, environment, audit, check, crewId }) {
  const [span, setSpan] = useState(14);
  const [open, setOpen] = useState(today);
  const days = rows.filter((r) => r.day <= today && r.day > today - span).sort((a, b) => b.day - a.day);
  const eventsByDay = useMemo(() => {
    const m = {};
    audit.forEach((e) => { if (e.crewId === crewId || e.type === 'WATCHDOG_ALERT' || e.actor === 'Watchdog') (m[e.missionDay] ||= []).push(e); });
    return m;
  }, [audit, crewId]);
  const statuses = useMemo(() => Object.fromEntries(days.map((r) => [r.day,
    Object.fromEntries(COLS.filter((c) => c.id !== 'mood').map((c) => [c.id, indicatorStatus(c.id, rows, r.day, rules, environment).status]))])), [days, rows, rules, environment]);

  const exportCsv = () => {
    const head = ['mission_day', 'bp_sys', 'bp_dia', 'hr_rest', 'temp', 'glucose', 'sleep_h', 'mood', 'stress', 'symptoms', 'ex_resist_min', 'source', 'statuses'];
    const lines = days.map((r) => [r.day, r.bp_sys, r.bp_dia, r.hr_rest, r.temp, r.glucose, r.sleep_h, r.mood, r.stress, (r.symptoms || []).join(' '), r.ex_resist_min,
      eventsByDay[r.day]?.some((e) => e.type === 'READING_SAVED') ? 'check-in (audited)' : 'simulated history',
      Object.entries(statuses[r.day]).map(([k, v]) => `${k}:${v}`).join(' ')].join(','));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' }));
    a.download = `astropulse-${crewId}-daily-records.csv`;
    a.click();
  };

  return (
    <section className="panel col gap12" aria-label="Daily records">
      <div className="row between wrap gap8">
        <div className="row gap8" role="group" aria-label="Days shown">
          {[[7, 'Last 7 days'], [14, 'Last 14 days'], [30, 'Last 30 days']].map(([n, l]) => (
            <button key={n} type="button" className="tab" aria-pressed={span === n} onClick={() => setSpan(n)}>{l}</button>
          ))}
        </div>
        <div className="row gap12">
          <span className="faint row gap8"><span style={{ color: 'var(--warn)' }}>▲ Watch</span><span style={{ color: 'var(--bad-text)' }}>◆ Act</span></span>
          <button type="button" className="tab" onClick={exportCsv}><Icon name="download" size={16} style={{ marginRight: 6 }} />Export CSV</button>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              <th style={th}>Day</th>
              {COLS.map((c) => <th key={c.id} style={th}>{c.head}<br /><span style={{ textTransform: 'none', fontWeight: 400 }}>{c.unit}</span></th>)}
              <th style={th}>Symptoms</th>
              <th style={th}>Overall</th>
              <th style={th}>Record</th>
            </tr>
          </thead>
          <tbody>
            {days.map((r) => {
              const st = statuses[r.day];
              const worst = Object.values(st).includes('act') ? 'act' : Object.values(st).includes('watch') ? 'watch' : 'normal';
              const evs = eventsByDay[r.day] || [];
              const audited = evs.some((e) => e.type === 'READING_SAVED');
              const isOpen = open === r.day && evs.length > 0;
              return (
                <Fragment key={r.day}>
                  <tr onClick={() => setOpen(isOpen ? null : r.day)} style={{ cursor: evs.length ? 'pointer' : 'default', background: r.day === today ? 'rgba(91,156,255,.07)' : undefined }}>
                    <td style={{ ...cell, fontWeight: 600 }}>{r.day}{r.day === today && <span className="faint" style={{ marginLeft: 6 }}>today</span>}</td>
                    {COLS.map((c) => {
                      const s = st[c.id] || 'normal';
                      return <td key={c.id} style={{ ...cell, color: COLORS[s], fontWeight: s === 'normal' ? 400 : 700 }}>{c.show(r)}{s === 'watch' && ' ▲'}{s === 'act' && ' ◆'}</td>;
                    })}
                    <td style={{ ...cell, color: 'var(--text-2)' }}>{(r.symptoms || []).join(', ') || '—'}</td>
                    <td style={cell}><StatusChip status={worst} /></td>
                    <td style={{ ...cell, color: audited ? (check.ok ? 'var(--ok)' : 'var(--bad-text)') : 'var(--faint)' }}>
                      {audited ? (check.ok ? `✓ Audited · ${evs.length} ${isOpen ? '▾' : '▸'}` : '✗ Chain broken') : evs.length ? `${evs.length} events ▸` : 'Simulated'}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={COLS.length + 4} style={{ padding: '4px 12px 14px', borderBottom: '1px solid var(--line)' }}>
                        <div className="panel-inset">
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <tbody>
                              {evs.map((e) => (
                                <tr key={e.seq}>
                                  <td style={{ padding: '6px 8px', color: 'var(--faint)', width: 40 }}>#{e.seq}</td>
                                  <td style={{ padding: '6px 8px', width: 90 }}>{new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                  <td style={{ padding: '6px 8px', width: 230, color: KIND(e.type) === 'normal' ? 'var(--link)' : COLORS[KIND(e.type)], fontWeight: 600 }}>{TYPES[e.type] || e.type}</td>
                                  <td style={{ padding: '6px 8px', color: 'var(--text-2)' }}>{describe(e)}</td>
                                  <td style={{ padding: '6px 8px', width: 160, color: 'var(--muted)' }}>{e.actor}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <span className="faint">Today's row uses the values from this morning's check-in. Earlier days are the simulated mission history. Statuses use the same engine rules as the rest of the app.</span>
    </section>
  );
}

function EventLog({ audit, replaceAudit, check }) {
  const [filter, setFilter] = useState('all');
  const shown = [...audit].reverse().filter((e) => filter === 'all' || KIND(e.type) === filter);
  const tamper = () => {
    if (audit.length < 2) return;
    const i = Math.max(0, audit.findIndex((e) => e.type === 'READING_SAVED'));
    replaceAudit(audit.map((e, j) => (j === i ? { ...e, detail: { ...e.detail, tampered_value: 'edited after the fact' } } : e)));
  };
  const restore = () => {
    let chain = [];
    for (const e of audit) {
      const { tampered_value, ...detail } = e.detail || {}; // eslint-disable-line no-unused-vars
      chain = [...chain, makeEntry(chain, { ts: e.ts, missionDay: e.missionDay, crewId: e.crewId, actor: e.actor, type: e.type, detail })];
    }
    replaceAudit(chain);
  };
  return (
    <section className="panel col gap12" aria-label="Event log">
      <div className="row between wrap gap8">
        <div className="row gap8" role="group" aria-label="Filter">
          {[['all', 'All'], ['act', 'Alerts'], ['watch', 'Decisions & re-measures'], ['normal', 'Readings & system']].map(([k, l]) => (
            <button key={k} type="button" className="tab" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <div className="row gap8">
          <button type="button" className="tab" onClick={tamper} title="Demo: edits an old entry to show detection">Tamper demo</button>
          {!check.ok && <button type="button" className="tab" onClick={restore}>Undo demo edit</button>}
        </div>
      </div>
      {audit.length === 0 && <span className="muted">Nothing logged yet. Do a check-in or open the watchdog.</span>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead><tr>{['#', 'Day', 'Time', 'Who', 'Event', 'What happened', 'Hash'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {shown.map((e) => {
              const broken = !check.ok && e.seq >= check.seq;
              return (
                <tr key={e.seq} style={{ background: broken ? 'rgba(255,107,74,.08)' : undefined }}>
                  <td style={{ ...cell, color: 'var(--faint)' }}>{e.seq}</td>
                  <td style={cell}>{e.missionDay}</td>
                  <td style={cell}>{new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                  <td style={cell}>{e.actor}</td>
                  <td style={{ ...cell, color: KIND(e.type) === 'normal' ? 'var(--link)' : COLORS[KIND(e.type)], fontWeight: 600 }}>{TYPES[e.type] || e.type}</td>
                  <td style={{ ...cell, whiteSpace: 'normal', color: 'var(--text-2)' }}>{describe(e)}{e.detail?.tampered_value && <span style={{ color: 'var(--bad-text)' }}> · {e.detail.tampered_value}</span>}</td>
                  <td style={{ ...cell, fontFamily: 'ui-monospace, monospace', fontSize: 12, color: broken ? 'var(--bad-text)' : 'var(--faint)' }} title={e.hash}>{e.hash.slice(0, 10)}…{broken && ' ✗'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <span className="faint">Each entry stores the hash of the one before it. Changing, deleting or reordering any entry breaks every hash after it. Stored on this tablet; the onboard hub would keep a replicated copy.</span>
    </section>
  );
}

export default function Audit() {
  const { audit, replaceAudit, fingerprint, today, crewId, crew, rows, rules, environment } = useData();
  const [view, setView] = useState('daily');
  const check = useMemo(() => verifyChain(audit), [audit]);
  const [lastCheck, setLastCheck] = useState(null);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), integrity: verifyChain(audit), entries: audit }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `astropulse-audit-day${today}.json`;
    a.click();
  };

  return (
    <>
      <PageHeader title="Health records & audit trail" subtitle={`${crew.name} · day-by-day readings, and every action chained with SHA-256 so nothing can be changed quietly`}
        right={<div className="row gap8 wrap">
          <button type="button" className="btn" onClick={() => setLastCheck({ ...verifyChain(audit), at: new Date().toLocaleTimeString() })}><Icon name="check" />Verify integrity</button>
          <button type="button" className="btn btn-primary" onClick={exportJson}><Icon name="download" />Export for flight surgeon</button>
        </div>} />

      <section className="split split-stats" style={{ '--cols': '1.4fr 1fr 1fr 1fr' }}>
        <div className="panel col gap8" style={{ borderColor: check.ok ? '#1E5A53' : 'var(--bad)', background: check.ok ? 'var(--ok-bg)' : 'var(--bad-bg)' }} role="status" aria-live="polite">
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: check.ok ? 'var(--ok)' : 'var(--bad-text)' }}>{check.ok ? 'Chain intact' : 'Tampering detected'}</span>
          <span style={{ fontSize: 15, lineHeight: 1.45 }}>{check.ok ? `All ${check.count} entries verified. Head hash ${check.head.slice(0, 12)}…` : `${check.reason}. Every entry after #${check.seq} can no longer be trusted.`}</span>
          {lastCheck && <span className="faint">Manual check {lastCheck.at}: {lastCheck.ok ? 'passed' : 'failed'}</span>}
        </div>
        <div className="panel col gap4"><span className="muted" style={{ fontWeight: 600 }}>Logged events</span><span className="big-num">{audit.length}</span></div>
        <div className="panel col gap4"><span className="muted" style={{ fontWeight: 600 }}>Alerts logged</span><span className="big-num" style={{ color: 'var(--bad-text)' }}>{audit.filter((e) => e.type === 'WATCHDOG_ALERT').length}</span></div>
        <div className="panel col gap4"><span className="muted" style={{ fontWeight: 600 }}>Dataset fingerprint</span><span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 15, marginTop: 6 }}>{fingerprint}</span><span className="faint">SHA-256 of daily.json</span></div>
      </section>

      <div className="row gap8" role="tablist" aria-label="View">
        <button type="button" role="tab" aria-selected={view === 'daily'} className="tab" onClick={() => setView('daily')}>Daily records</button>
        <button type="button" role="tab" aria-selected={view === 'log'} className="tab" onClick={() => setView('log')}>Event log ({audit.length})</button>
      </div>

      {view === 'daily'
        ? <DailyRecords rows={rows} today={today} rules={rules} environment={environment} audit={audit} check={check} crewId={crewId} />
        : <EventLog audit={audit} replaceAudit={replaceAudit} check={check} />}
    </>
  );
}
