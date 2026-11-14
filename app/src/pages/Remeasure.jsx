// "Can I trust this reading?" A jump far outside the person's normal
// day-to-day change asks for a re-measure before any alarm.
import { useLocation, Link, Navigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useData } from '../data/DataContext.jsx';
import { personalBaseline } from '../engine/engine.js';
import { Icon } from '../components/ui.jsx';

const CAUSES = ['Cuff loose or over a sleeve', 'Arm not at heart level', 'Talking or moving', 'Right after exercise'];

export default function Remeasure() {
  const { state } = useLocation();
  const { rows, today, saveReading, daily, crewId, log } = useData();
  const loggedPrompt = useRef(false);
  const original = daily.find((r) => r.crew_id === crewId && r.day === today);
  const [phase, setPhase] = useState('ask');
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!state || loggedPrompt.current) return;
    loggedPrompt.current = true;
    log('REMEASURE_PROMPTED', { entered: `${state.sys}/${state.dia}`, jump_mmHg: Math.round(state.check?.jump ?? 0), usual_daily_change: state.check?.spread }, 'AstroPulse engine');
  }, [state, log]);
  if (!state) return <Navigate to="/checkin" replace />;

  const row = rows.find((r) => r.day === today);
  const sysBase = personalBaseline(rows, 'bp_sys', today, 3);
  const diaBase = personalBaseline(rows, 'bp_dia', today, 3);
  const lo = (b) => Math.round(b.mean - 2 * b.sd);
  const hi = (b) => Math.round(b.mean + 2 * b.sd);
  // In the demo, the second measurement is today's real value from daily.json.
  // (If this crew member has no story re-measure, the second reading equals the first.)
  const confirmed = original.bp_rejected ? { sys: original.bp_sys, dia: original.bp_dia } : { sys: state.sys, dia: state.dia };

  const remeasure = () => {
    setPhase('measuring');
    timer.current = setTimeout(() => {
      log('READING_REPLACED', { from: `${state.sys}/${state.dia}`, to: `${confirmed.sys}/${confirmed.dia}` });
      saveReading('bp', confirmed);
      setPhase('done');
    }, 1800);
  };
  const keep = () => {
    log('READING_KEPT', { reading: `${state.sys}/${state.dia}`, note: 'kept without re-measuring' });
    saveReading('bp', { sys: state.sys, dia: state.dia, kept: true });
  };

  return (
    <div className="row" style={{ flex: 1, justifyContent: 'center' }}>
      <section role="dialog" aria-labelledby="rm-title" className="panel col gap20 dialog" style={{ animation: 'fadeUp .4s ease both' }}>
        <div className="row gap16">
          <div className="icon-btn" style={{ width: 56, height: 56, color: 'var(--link)' }}><Icon name="refresh" size={30} /></div>
          <div className="col gap4">
            <span className="eyebrow">Before we flag anything</span>
            <h1 id="rm-title" className="h1" style={{ fontSize: 30 }}>{phase === 'done' ? 'Reading confirmed' : "Let's double-check this reading"}</h1>
          </div>
        </div>

        <div className="grid-2">
          <div className="panel-inset col gap4" aria-live="polite" style={{ border: '1px solid var(--warn-line)', borderRadius: 18, padding: 20, minHeight: 118 }}>
            <span className="muted" style={{ fontWeight: 600 }}>{phase === 'done' ? 'Re-measured' : 'You entered'}</span>
            {phase === 'ask' && <><span style={{ fontFamily: 'var(--display)', fontSize: 40, fontWeight: 600, color: 'var(--warn)', animation: 'shake .5s ease-in-out .5s 2 both', display: 'inline-block' }}>{state.sys}/{state.dia}</span><span className="muted" style={{ fontSize: 13 }}>mmHg · {row.bp_rejected?.time || 'now'} ship time</span></>}
            {phase === 'measuring' && <div className="row gap12" style={{ height: 70 }}><span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: '50%', border: '4px solid var(--line)', borderTopColor: 'var(--link)', animation: 'spin .9s linear infinite' }} /><span style={{ fontSize: 18, fontWeight: 600 }}>Measuring… keep still</span></div>}
            {phase === 'done' && <><span style={{ fontFamily: 'var(--display)', fontSize: 40, fontWeight: 600, color: 'var(--warn)', animation: 'fadeUp .4s ease both' }}>{confirmed.sys}/{confirmed.dia}</span><span className="muted" style={{ fontSize: 13 }}>mmHg · {row.bp_time || 'now'} · <s>{state.sys}/{state.dia}</s> replaced</span></>}
          </div>
          <div className="panel-inset col gap4" style={{ borderRadius: 18, padding: 20 }}>
            <span className="muted" style={{ fontWeight: 600 }}>Your usual in flight</span>
            <span style={{ fontFamily: 'var(--display)', fontSize: 36, fontWeight: 600 }}>{lo(sysBase)}–{hi(sysBase)} / {lo(diaBase)}–{hi(diaBase)}</span>
            <span className="muted" style={{ fontSize: 13 }}>Your own range (14-day baseline ± 2 SD)</span>
          </div>
        </div>

        {phase !== 'done' ? (<>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: 'var(--text-2)' }}>
            That's a jump of {Math.round(state.check?.jump ?? 0)} mmHg since yesterday, about {Math.round(Math.abs(state.check?.jump ?? 0) / (state.check?.spread || 1))}× your normal day-to-day change. A quick re-measure rules out a common slip before we raise anything with the crew.
          </p>
          <div className="col gap8">
            <span className="muted" style={{ fontWeight: 600 }}>Common causes of a wrong reading</span>
            <ul className="grid-2" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {CAUSES.map((c) => <li key={c} className="panel-inset row gap8" style={{ padding: '12px 14px', borderRadius: 12 }}><Icon name="check" size={18} style={{ color: 'var(--link)' }} />{c}</li>)}
            </ul>
          </div>
          <div className="row gap12">
            <button type="button" className="btn btn-primary btn-big" style={{ flex: 2 }} onClick={remeasure} disabled={phase === 'measuring'}><Icon name="refresh" />{phase === 'measuring' ? 'Measuring…' : 'Re-measure now'}</button>
            <Link to="/checkin?step=2" className="btn btn-big" style={{ flex: 1, fontSize: 16 }} onClick={keep}>Keep this reading</Link>
          </div>
        </>) : (<>
          <div className="row gap12" style={{ background: '#2A2310', border: '1px solid var(--warn-line)', borderRadius: 16, padding: 18, alignItems: 'flex-start', animation: 'fadeUp .4s ease .2s both' }}>
            <span style={{ color: 'var(--warn)' }}>▲</span>
            <span style={{ fontSize: 16, lineHeight: 1.5, color: '#F2E6C4' }}>Good catch: the first reading was off. The new one is confirmed, but still <strong>above your usual range</strong>. It's saved; finish your check-in, then see what it means.</span>
          </div>
          <div className="row gap12" style={{ animation: 'fadeUp .4s ease .35s both' }}>
            <Link to="/checkin?step=2" className="btn btn-primary btn-big" style={{ flex: 2 }}>Continue check-in · 5 left<Icon name="next" /></Link>
            <Link to="/trends/bp" className="btn btn-big" style={{ flex: 1, fontSize: 16 }}>See what this means</Link>
          </div>
        </>)}
        <p className="faint" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>Why we ask: a false alarm costs crew time and worry; a missed real change costs health. Re-checking guards against both.</p>
      </section>
    </div>
  );
}
