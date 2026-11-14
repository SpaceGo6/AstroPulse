// Morning check-in: one indicator per step, with how-to text from rules.json.
// Blood pressure runs the re-measure check before anything is flagged.
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { useData } from '../data/DataContext.jsx';
import { needsRemeasure, allStatuses } from '../engine/engine.js';
import { Icon, PageHeader } from '../components/ui.jsx';

const STEPS = [
  { key: 'bp', rule: 'bp', title: 'Blood pressure', source: 'Cuff' },
  { key: 'hr', rule: 'hr_rest', title: 'Heart rate', source: 'Wearable' },
  { key: 'temp', rule: 'temp', title: 'Temperature', source: 'Thermometer' },
  { key: 'glucose', rule: 'glucose', title: 'Blood sugar', source: 'Glucose meter' },
  { key: 'sleep', rule: 'sleep', title: 'Sleep', source: 'Wearable' },
  { key: 'mood', rule: 'mood', title: 'Mood & symptoms', source: 'Self-report' },
];
const SYMPTOMS = ['headache', 'nausea', 'sore throat', 'rash', 'vision changes', 'congestion'];

function Stepper({ id, label, value, step = 1, decimals = 0, min, max, onChange }) {
  const set = (v) => onChange(+Math.min(max, Math.max(min, v)).toFixed(decimals));
  return (
    <div className="col gap8">
      <span id={id} className="muted" style={{ fontSize: 15, fontWeight: 600 }}>{label}</span>
      <div className="stepper">
        <button type="button" className="step-btn" aria-label={`Decrease ${label}`} onClick={() => set(value - step)}>−</button>
        <output className="step-val" aria-labelledby={id}><span key={value} style={{ display: 'inline-block', animation: 'fadeUp .15s ease' }}>{value.toFixed(decimals)}</span></output>
        <button type="button" className="step-btn" aria-label={`Increase ${label}`} onClick={() => set(value + step)}>+</button>
      </div>
    </div>
  );
}

function Scale({ label, value, onChange }) {
  return (
    <div className="col gap8">
      <span className="muted" style={{ fontSize: 15, fontWeight: 600 }}>{label}</span>
      <div className="row gap8" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" className="tab" aria-pressed={value === n} onClick={() => onChange(n)} style={{ flex: 1, minHeight: 56, fontSize: 18 }}>{n}</button>
        ))}
      </div>
    </div>
  );
}

export default function CheckIn() {
  const { rows, today, rules, crew, checkin, saveReading, log, environment } = useData();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const stepIdx = Math.min(STEPS.length, Math.max(0, Number(params.get('step') || 1) - 1));
  const row = rows.find((r) => r.day === today);
  const isStoryDay = crew.id === 'maya' && row.bp_rejected;
  const savedKeys = new Set(Object.keys(checkin));

  // Starting values: the story's slipped-cuff reading for Maya, otherwise today's data.
  const [vals, setVals] = useState(() => ({
    bp_sys: checkin.bp ? checkin.bp.sys : isStoryDay ? row.bp_rejected.sys : row.bp_sys,
    bp_dia: checkin.bp ? checkin.bp.dia : isStoryDay ? row.bp_rejected.dia : row.bp_dia,
    hr: row.hr_rest, temp: row.temp, glucose: row.glucose, sleep: row.sleep_h,
    mood: row.mood, stress: row.stress, symptoms: row.symptoms || [],
  }));
  const set = (k) => (v) => setVals((p) => ({ ...p, [k]: v }));
  const goto = (n) => setParams({ step: String(n) });

  if (stepIdx >= STEPS.length) {
    return (
      <>
        <PageHeader title="Check-in complete" subtitle={`Mission day ${today}`} />
        <div className="panel col gap16" style={{ maxWidth: 720 }}>
          <span style={{ fontSize: 17 }}>{savedKeys.size} of {STEPS.length} readings saved on this tablet and synced to the onboard hub.</span>
          <ul className="col gap8" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {STEPS.map((s, i) => {
              const v = checkin[s.key];
              const text = !v ? 'not entered' : s.key === 'bp' ? `${v.sys}/${v.dia} mmHg` : s.key === 'mood' ? `mood ${v.mood}/5, stress ${v.stress}/5${v.symptoms?.length ? `, ${v.symptoms.join(', ')}` : ''}` : `${v.value}`;
              return (
                <li key={s.key} className="row between panel-inset" style={{ padding: '10px 14px' }}>
                  <span className="row gap8">{v ? <Icon name="check" size={16} style={{ color: 'var(--ok)' }} /> : <span style={{ width: 16 }} />}{s.title}</span>
                  <button type="button" className="row gap8" onClick={() => goto(i + 1)} style={{ all: 'unset', cursor: 'pointer', color: v ? 'var(--text)' : 'var(--link)' }}>{text}{!v && ' · add'}</button>
                </li>
              );
            })}
          </ul>
          <div className="row gap12 wrap">
            <Link to="/" className="btn btn-primary">See today's status<Icon name="next" /></Link>
            <Link to="/trends/bp" className="btn">Blood pressure trend</Link>
          </div>
        </div>
      </>
    );
  }

  const step = STEPS[stepIdx];
  const rule = rules.indicators.find((i) => i.id === step.rule) || {};

  const save = () => {
    if (step.key === 'bp') {
      const check = needsRemeasure(rows, 'bp_sys', today, vals.bp_sys);
      if (check.remeasure) {
        navigate('/remeasure', { state: { sys: vals.bp_sys, dia: vals.bp_dia, check } });
        return;
      }
      saveReading('bp', { sys: vals.bp_sys, dia: vals.bp_dia });
    } else if (step.key === 'mood') {
      saveReading('mood', { mood: vals.mood, stress: vals.stress, symptoms: vals.symptoms });
      // Record what the engine concluded from this check-in.
      const st = allStatuses(rows, today, rules, environment, ['bp', 'hr', 'sleep', 'glucose', 'temp', 'bone', 'radiation']);
      log('ENGINE_DECISION', Object.fromEntries(Object.entries(st).map(([k, v]) => [k, v.status])), 'AstroPulse engine');
      log('CHECKIN_COMPLETED', { readings_saved: new Set([...Object.keys(checkin), 'mood']).size });
    } else {
      saveReading(step.key, { value: vals[step.key] });
    }
    goto(stepIdx + 2);
  };

  return (
    <>
      <PageHeader title={step.title} subtitle={`Morning check-in · step ${stepIdx + 1} of ${STEPS.length} · ${step.source}`}
        right={<span className="muted">{savedKeys.size} of {STEPS.length} saved · tap any step to jump</span>} />

      <div>
        <div className="progress" role="progressbar" aria-label="Check-in progress" aria-valuemin={0} aria-valuemax={6} aria-valuenow={stepIdx + 1}>
          {STEPS.map((s, i) => <div key={s.key}>{i <= stepIdx && <span />}</div>)}
        </div>
        <div className="progress step-tabs" style={{ marginTop: 10 }} role="tablist" aria-label="Check-in steps">
          {STEPS.map((s, i) => (
            <button key={s.key} type="button" role="tab" aria-selected={i === stepIdx} className="tab" onClick={() => goto(i + 1)}
              style={{ justifyContent: 'center', fontSize: 13, padding: '0 6px', gap: 6 }}>
              {savedKeys.has(s.key) && <Icon name="check" size={14} style={{ color: 'var(--ok)' }} />}{s.title}
            </button>
          ))}
        </div>
      </div>

      <div className="split" style={{ '--cols': '1fr 1.15fr' }}>
        <section className="panel col gap16" aria-label="How to measure" style={{ animation: 'fadeUp .4s ease both' }}>
          <h2 className="h2">How to measure</h2>
          <ol className="num-list">
            {(rule.how_to_measure || '').split(/;\s*|\.\s+/).filter(Boolean).map((t, i) => (
              <li key={i}><span className="num">{i + 1}</span>{t.charAt(0).toUpperCase() + t.slice(1).replace(/\.$/, '')}.</li>
            ))}
          </ol>
          <div className="panel-inset row gap12" style={{ marginTop: 'auto', alignItems: 'flex-start', fontSize: 14, lineHeight: 1.45, color: '#B8C4D8' }}>
            <Icon name="info" size={22} style={{ flex: 'none', color: 'var(--link)' }} />
            <span><strong style={{ color: 'var(--text)' }}>Why it matters in space:</strong> {rule.why_in_space} {rule.hazards && <span style={{ color: 'var(--link)' }}>NASA hazards: {rule.hazards.join(', ')}</span>}</span>
          </div>
        </section>

        <section className="panel col gap20" aria-label="Your reading" style={{ animation: 'fadeUp .4s ease .08s both' }}>
          <h2 className="h2">Your reading</h2>
          {step.key === 'bp' && (<>
            <Stepper id="sys" label="Systolic (top number)" value={vals.bp_sys} min={60} max={250} onChange={set('bp_sys')} />
            <Stepper id="dia" label="Diastolic (bottom number)" value={vals.bp_dia} min={30} max={160} onChange={set('bp_dia')} />
          </>)}
          {step.key === 'hr' && <Stepper id="hr" label="Resting heart rate (bpm) · from your wearable" value={vals.hr} min={30} max={200} onChange={set('hr')} />}
          {step.key === 'temp' && <Stepper id="temp" label="Temperature (°C)" value={vals.temp} step={0.1} decimals={1} min={34} max={42} onChange={set('temp')} />}
          {step.key === 'glucose' && <Stepper id="glu" label="Fasting blood sugar (mg/dL)" value={vals.glucose} min={40} max={400} onChange={set('glucose')} />}
          {step.key === 'sleep' && <Stepper id="sleep" label="Sleep last night (hours) · from your wearable" value={vals.sleep} step={0.1} decimals={1} min={0} max={14} onChange={set('sleep')} />}
          {step.key === 'mood' && (<>
            <Scale label="Mood (1 = very low, 5 = great)" value={vals.mood} onChange={set('mood')} />
            <Scale label="Stress (1 = calm, 5 = very stressed)" value={vals.stress} onChange={set('stress')} />
            <div className="col gap8">
              <span className="muted" style={{ fontSize: 15, fontWeight: 600 }}>Any symptoms?</span>
              <div className="row gap8 wrap">
                {SYMPTOMS.map((s) => {
                  const on = vals.symptoms.includes(s);
                  return <button key={s} type="button" className="tab" aria-pressed={on} onClick={() => set('symptoms')(on ? vals.symptoms.filter((x) => x !== s) : [...vals.symptoms, s])}>{s}</button>;
                })}
              </div>
            </div>
          </>)}
          {(step.key === 'hr' || step.key === 'sleep') && (
            <span className="btn btn-ghost" style={{ borderStyle: 'dashed', cursor: 'default' }}><Icon name="download" />Bio-Monitor connected (simulated) · value pre-filled</span>
          )}
          <div className="row gap12" style={{ marginTop: 'auto' }}>
            {stepIdx > 0 && <button type="button" className="btn" onClick={() => goto(stepIdx)}>Back</button>}
            <button type="button" className="btn btn-primary btn-big grow" onClick={save}>{stepIdx === STEPS.length - 1 ? 'Finish check-in' : 'Save reading'}<Icon name="next" /></button>
          </div>
        </section>
      </div>
    </>
  );
}
