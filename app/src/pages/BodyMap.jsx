// Clickable body figure (the challenge's own example). Each area shows what it does,
// what spaceflight does to it, the NASA hazards involved, and live status from the engine.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../data/DataContext.jsx';
import { allStatuses } from '../engine/engine.js';
import { PageHeader, StatusChip } from '../components/ui.jsx';

const REGIONS = [
  { id: 'brain', name: 'Brain & mind', x: 180, y: 70, indicators: ['sleep', 'mood'], rule: 'mood',
    does: 'Controls sleep, mood, focus and decision-making, all critical for mission tasks.' },
  { id: 'immune', name: 'Immune system', x: 180, y: 128, indicators: ['temp', 'glucose'], rule: 'temp',
    does: 'Fights infection and keeps dormant viruses in check.' },
  { id: 'heart', name: 'Heart & blood vessels', x: 208, y: 205, indicators: ['bp', 'hr'], rule: 'bp',
    does: 'Pumps blood and keeps pressure steady so every organ gets oxygen.' },
  { id: 'cells', name: 'Cells & DNA (radiation)', x: 150, y: 285, indicators: ['radiation'], rule: 'radiation',
    does: 'Every cell carries DNA that radiation can damage over time.' },
  { id: 'bones', name: 'Bones & muscles', x: 152, y: 440, indicators: ['bone'], rule: 'bone',
    does: 'Carries your weight and lets you move, lift and work.' },
];
const RANK = { normal: 0, watch: 1, act: 2 };

export default function BodyMap() {
  const { rows, today, rules, environment } = useData();
  const [picked, setPicked] = useState('heart');
  const statuses = allStatuses(rows, today, rules, environment, ['bp', 'hr', 'sleep', 'mood', 'glucose', 'temp', 'bone', 'radiation']);
  const regionStatus = (r) => r.indicators.map((i) => statuses[i].status).sort((a, b) => RANK[b] - RANK[a])[0];
  const cur = REGIONS.find((r) => r.id === picked);
  const rule = rules.indicators.find((i) => i.id === cur.rule) || {};
  const st = regionStatus(cur);

  return (
    <>
      <PageHeader title="Your body in space" subtitle="Tap an area to see what it does, how spaceflight affects it, and how you're doing" />
      <div className="split" style={{ '--cols': 'minmax(300px, 420px) 1fr' }}>
        <section className="panel" aria-label="Body figure" style={{ display: 'grid', placeItems: 'center' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 360, aspectRatio: '360 / 640', margin: '0 auto' }}>
            <svg width="100%" height="100%" viewBox="0 0 360 640" aria-hidden="true" style={{ display: 'block' }}>
              <g fill="#1B2840" stroke="#2C3A57" strokeWidth="2" strokeLinejoin="round">
                <circle cx="180" cy="75" r="42" /><rect x="166" y="114" width="28" height="24" rx="6" />
                <path d="M110 145 L72 330 L94 336 L130 200 Z" /><path d="M250 145 L288 330 L266 336 L230 200 Z" />
                <path d="M112 335 L132 610 L172 610 L178 350 Z" /><path d="M248 335 L228 610 L188 610 L182 350 Z" />
                <path d="M108 140 Q180 124 252 140 L262 338 Q180 358 98 338 Z" />
              </g>
            </svg>
            <div aria-hidden="true" key={picked} style={{ position: 'absolute', left: `${(cur.x / 360) * 100}%`, top: `${(cur.y / 640) * 100}%`, transform: 'translate(-50%, -50%)', width: '38%', aspectRatio: '1', borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,156,255,.35), rgba(91,156,255,0) 70%)', animation: 'fadeUp .35s ease both', pointerEvents: 'none' }} />
            {REGIONS.map((r) => {
              const s = regionStatus(r); const sel = r.id === picked; const size = sel ? 52 : 44;
              const ring = s === 'act' ? 'var(--bad)' : s === 'watch' ? 'var(--warn)' : 'var(--ok)';
              return (
                <button key={r.id} type="button" onClick={() => setPicked(r.id)} aria-pressed={sel} aria-label={`${r.name}, ${s}`}
                  style={{ position: 'absolute', left: `calc(${(r.x / 360) * 100}% - ${size / 2}px)`, top: `calc(${(r.y / 640) * 100}% - ${size / 2}px)`, width: size, height: size, borderRadius: '50%', border: `3px solid ${ring}`, background: sel ? '#0A1020' : 'rgba(10,16,32,.6)', cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center',
                    outline: sel ? '3px solid var(--accent)' : 'none', outlineOffset: 4, animation: s !== 'normal' ? 'pulseRing 2s ease-out infinite' : 'none', transition: 'all .2s' }}>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', background: ring }} />
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel col gap16" aria-live="polite" aria-label="Selected body area">
          <div className="row gap8 wrap">
            {REGIONS.map((r) => <button key={r.id} type="button" className="tab" aria-pressed={r.id === picked} onClick={() => setPicked(r.id)}>{r.name.split(' (')[0]}</button>)}
          </div>
          <div key={picked} className="col gap16" style={{ animation: 'fadeUp .35s ease both' }}>
            <div className="row between"><h2 className="h1" style={{ fontSize: 26 }}>{cur.name}</h2><StatusChip status={st} big /></div>
            <div className="col gap8">
              <span className="eyebrow">Your status</span>
              {cur.indicators.map((i) => (
                <Link key={i} to={i === 'bone' || i === 'radiation' ? '/forecast' : `/trends/${i}`} className="row between" style={{ color: 'var(--text)', textDecoration: 'none', fontSize: 15 }}>
                  <span>{rules.indicators.find((x) => x.id === (i === 'hr' ? 'hr_rest' : i === 'bp' ? 'bp' : i))?.label || i}: {statuses[i].note}</span><StatusChip status={statuses[i].status} />
                </Link>
              ))}
            </div>
            <div className="grid-2">
              <div className="panel-inset col gap4"><span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>What it does</span><p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--text-2)' }}>{cur.does}</p></div>
              <div className="panel-inset col gap4"><span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>What spaceflight does to it</span><p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--text-2)' }}>{rule.why_in_space}</p></div>
            </div>
            <div className="col gap8">
              <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>NASA hazards involved</span>
              <div className="row gap8 wrap">{(rule.hazards || []).map((h) => <span key={h} className="pill">{h}</span>)}</div>
            </div>
            {rule.actions?.self_care && <div className="panel panel-accent" style={{ padding: 18 }}><strong>What helps:</strong> <span style={{ color: 'var(--text-2)' }}>{rule.actions.self_care}</span></div>}
          </div>
          <span className="faint" style={{ marginTop: 'auto' }}>Source: NASA Human Research Program · 5 Hazards &amp; Risks of Human Spaceflight · CSA radiation monitoring</span>
        </section>
      </div>
    </>
  );
}
