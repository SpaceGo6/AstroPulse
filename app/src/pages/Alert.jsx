// Triage Mode. Plays Leo's per-minute wearable feed; the watchdog (pure engine
// function) fires when HR and SpO2 go out of range together, then the screen
// turns into a full-screen Red Alert with step-by-step triage. No network used.
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts';
import { useData } from '../data/DataContext.jsx';
import { watchdog } from '../engine/engine.js';
import { sendCrewMessage } from '../sync/channel.js';
import { Icon } from '../components/ui.jsx';

const START_MIN = 58;
const TICK_MS = 450; // one simulated minute per tick

export default function Alert() {
  const { stream_emergency: stream, triage, crewList, log } = useData();
  const patient = crewList.find((c) => c.id === stream.crew_id);
  const alertAt = useMemo(() => watchdog(stream.rows), [stream]);
  const scenario = triage.scenarios.find((s) => s.id === 'hypoxia_tachycardia');
  const [minute, setMinute] = useState(START_MIN);
  const [done, setDone] = useState(() => scenario.steps.map(() => false));
  const [secs, setSecs] = useState(0);
  const sent = useRef(false);

  const firing = alertAt && minute >= alertAt.minute;
  useEffect(() => {
    if (minute >= stream.rows.length - 1) return undefined;
    const t = setTimeout(() => setMinute((m) => m + 1), firing ? TICK_MS * 4 : TICK_MS);
    return () => clearTimeout(t);
  }, [minute, firing, stream.rows.length]);
  useEffect(() => {
    if (!firing) return undefined;
    if (!sent.current) {
      sent.current = true;
      sendCrewMessage({ type: 'red-alert', crewName: patient.name, trigger: alertAt.trigger });
      log('WATCHDOG_ALERT', { patient: patient.name, minute: alertAt.minute, heart_rate: alertAt.hr, spo2: alertAt.spo2, rule: 'HR > 130 and SpO2 < 90' }, 'Watchdog');
    }
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [firing, patient.name, alertAt, log]);

  const now = stream.rows[minute];
  const view = stream.rows.slice(Math.max(0, minute - 25), minute + 1);
  const restart = () => { setMinute(START_MIN); setSecs(0); setDone(scenario.steps.map(() => false)); sent.current = false; };
  const firstOpen = done.indexOf(false);
  const clock = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  const hrBad = now.hr > 130; const spBad = now.spo2 < 90;

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: firing ? '#140A0C' : 'var(--bg-deep)', color: '#F6ECEA', animation: firing ? 'alarm 1.6s ease-in-out infinite' : 'none', transition: 'background .4s' }}>
      <header role={firing ? 'alert' : undefined} className="row between gap16 wrap alert-pad" style={{ background: firing ? '#4A1710' : 'var(--panel-2)', borderBottom: '1px solid var(--line)', animation: firing ? 'fadeUp .4s ease both' : 'none' }}>
        <div className="row gap16">
          {firing
            ? <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--bad)', color: '#1A0805', display: 'grid', placeItems: 'center', animation: 'blink 1.2s ease-in-out infinite' }}><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2l10 10-10 10L2 12z" /><path d="M12 8v5M12 16h.01" /></svg></div>
            : <Link to="/" className="icon-btn" aria-label="Back to Today"><Icon name="back" /></Link>}
          <div className="col gap4">
            <span className="eyebrow" style={{ color: firing ? '#FFB4A3' : 'var(--ok)' }}>{firing ? 'Red Alert · Triage Mode' : 'Watchdog · monitoring live feed'}</span>
            <h1 className="h1">{firing ? `${patient.name}: ${scenario.title.toLowerCase()}` : `${patient.name} · ${patient.role}`}</h1>
          </div>
        </div>
        <div className="col gap4" style={{ alignItems: 'flex-end' }}>
          {firing && <span style={{ fontFamily: 'var(--display)', fontSize: 30, fontWeight: 600 }} aria-label="Time since alert">{clock}</span>}
          <span className="pill" style={{ background: firing ? '#2A0F0B' : undefined, borderColor: firing ? '#6B2A1E' : undefined, color: '#FFD2C7' }}><Icon name="wifiOff" size={14} />On this tablet · no Earth link needed</span>
        </div>
      </header>

      <div className="split alert-pad" style={{ '--cols': '1fr 1.25fr', flex: 1 }}>
        <section className="col gap16" aria-label="Live vitals">
          <div className="grid-2">
            {[['Heart rate', now.hr, 'bpm', 'Limit 130', hrBad], ['Oxygen (SpO₂)', now.spo2.toFixed(1), '%', 'Limit 90', spBad]].map(([l, v, u, lim, bad]) => (
              <div key={l} className="col gap4" style={{ background: bad ? '#2A0F0B' : 'var(--panel)', border: `2px solid ${bad ? 'var(--bad)' : 'var(--line)'}`, borderRadius: 18, padding: 18, transition: 'all .3s' }}>
                <span style={{ fontSize: 14, color: bad ? '#FFB4A3' : 'var(--muted)', fontWeight: 600 }}>{l}</span>
                <span style={{ fontFamily: 'var(--display)', fontSize: 44, fontWeight: 600 }}>{v}<span style={{ fontSize: 16, color: '#E0C4BE' }}> {u}</span></span>
                <span style={{ fontSize: 13, color: '#E0C4BE' }}>{lim}</span>
              </div>
            ))}
          </div>
          <div className="col gap8" style={{ background: firing ? '#1E0D0C' : 'var(--panel)', border: '1px solid var(--line)', borderRadius: 18, padding: 18 }}>
            <div className="row between"><span style={{ fontSize: 14, color: '#E0C4BE', fontWeight: 600 }}>Wearable feed · minute {minute} · mission day {stream.mission_day}</span>
              <button type="button" className="tab" onClick={restart}>Restart demo</button></div>
            <div style={{ height: 190 }} role="img" aria-label="Heart rate and oxygen over the last 25 minutes">
              <ResponsiveContainer>
                <LineChart data={view} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <XAxis dataKey="minute" stroke="#8F9CB3" fontSize={11} tickLine={false} />
                  <YAxis yAxisId="hr" domain={[50, 150]} stroke="#FF8A70" fontSize={11} tickLine={false} />
                  <YAxis yAxisId="sp" orientation="right" domain={[84, 100]} stroke="#8DB8FF" fontSize={11} tickLine={false} />
                  <ReferenceLine yAxisId="hr" y={130} stroke="#FF6B4A" strokeDasharray="4 4" />
                  <ReferenceLine yAxisId="sp" y={90} stroke="#8DB8FF" strokeDasharray="4 4" />
                  <Tooltip contentStyle={{ background: '#0E1626', border: '1px solid #2C3A57', borderRadius: 10 }} labelFormatter={(m) => `Minute ${m}`} />
                  <Line yAxisId="hr" dataKey="hr" name="Heart rate" stroke="#FF8A70" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                  <Line yAxisId="sp" dataKey="spo2" name="SpO₂" stroke="#8DB8FF" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <span className="faint" style={{ color: '#C9AFA9' }}>Watchdog rule: heart rate above 130 <em>and</em> SpO₂ below 90 at the same time. {firing ? `Fired at minute ${alertAt.minute}.` : 'Monitoring…'}</span>
          </div>
          {firing && (
            <div className="col gap8" style={{ marginTop: 'auto' }}>
              <button type="button" className="btn btn-big" onClick={() => log('CMO_CALLED', { patient: patient.name, heart_rate: now.hr, spo2: now.spo2 })} style={{ background: 'var(--bad)', borderColor: 'var(--bad)', color: '#1A0805', fontWeight: 700 }}><Icon name="phone" size={22} />Call crew medical officer</button>
              <div className="row gap8">
                <button type="button" className="btn grow" onClick={() => log('REPORT_QUEUED', { patient: patient.name, to: 'flight surgeon', send: 'next downlink window' })} style={{ background: '#2A0F0B', borderColor: '#6B2A1E', color: '#F6ECEA', fontSize: 14 }}>Send report to flight surgeon · reply ~36 min</button>
                <Link to="/" className="btn" onClick={() => log('ALERT_EXITED', { patient: patient.name, steps_done: done.filter(Boolean).length })} style={{ background: 'transparent', borderColor: '#4A2520', color: '#E0C4BE', fontSize: 14 }}>False alarm? Exit</Link>
              </div>
            </div>
          )}
        </section>

        <section className="col gap12" aria-label="Triage steps" style={{ background: firing ? '#1E0D0C' : 'var(--panel)', border: `1px solid ${firing ? '#4A2520' : 'var(--line)'}`, borderRadius: 20, padding: 22, opacity: firing ? 1 : 0.55, transition: 'opacity .4s' }}>
          <div className="row between">
            <h2 className="h2" style={{ fontSize: 21 }}>{firing ? 'Do these steps now' : 'Triage steps appear if the watchdog fires'}</h2>
            {firing && <span style={{ color: '#FFB4A3', fontWeight: 600, fontSize: 14 }}>{done.filter(Boolean).length} of {done.length} done</span>}
          </div>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {scenario.steps.map((text, i) => {
              const isDone = done[i]; const cur = firing && i === firstOpen;
              const [title, ...rest] = text.split(/;\s*|,\s(?=the crew)/);
              return (
                <li key={i}>
                  <button type="button" disabled={!firing} aria-pressed={isDone} onClick={() => { log('TRIAGE_STEP', { patient: patient.name, step: i + 1, step_text: title, done: !isDone }); setDone(done.map((v, j) => (j === i ? !v : v))); }}
                    style={{ width: '100%', minHeight: 60, display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', borderRadius: 14, cursor: firing ? 'pointer' : 'default', color: '#F6ECEA', textAlign: 'left',
                      background: cur ? '#3A1510' : 'transparent', border: cur ? '2px solid var(--bad)' : '1px solid #3A2420', opacity: isDone ? 0.6 : 1 }}>
                    <span style={{ flex: 'none', width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 700, background: isDone ? '#2E5C3A' : cur ? 'var(--bad)' : '#3A2420', color: isDone ? '#CFF5D6' : cur ? '#1A0805' : '#F6ECEA' }}>{isDone ? '✓' : i + 1}</span>
                    <span className="col gap4"><span style={{ fontSize: 16, fontWeight: 600, textDecoration: isDone ? 'line-through' : 'none' }}>{title}</span>{rest.length > 0 && <span style={{ fontSize: 13, color: '#C9AFA9' }}>{rest.join('; ')}</span>}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <span style={{ marginTop: 'auto', fontSize: 12, color: '#A88E88', lineHeight: 1.5 }}>{triage.note} Simulated data.</span>
        </section>
      </div>
    </div>
  );
}
