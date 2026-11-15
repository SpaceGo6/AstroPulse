// Result / trends for one indicator: 30-day chart vs the personal space baseline,
// what it means, what to do, and the NASA/CSA source behind the rule.
import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, ReferenceArea, ReferenceLine, Tooltip, ResponsiveContainer, CartesianGrid, Dot } from 'recharts';
import { useData } from '../data/DataContext.jsx';
import { byId } from '../engine/indicators.js';
import { indicatorStatus } from '../engine/engine.js';
import { Icon, PageHeader, StatusChip } from '../components/ui.jsx';

const TABS = ['bp', 'hr', 'sleep', 'mood', 'glucose', 'temp'];
const GENERIC = {
  normal: { self_care: 'Nothing to change. Keep your routine.', crew: null, flight_surgeon: null },
  watch: { self_care: 'Keep logging daily and follow the tips in "Why it changes".', crew: 'Tell the crew medical officer if it continues 3 more days.', flight_surgeon: 'Include in the weekly report to the flight surgeon.' },
  act: { self_care: 'Stop and re-measure now.', crew: 'Tell the crew medical officer now.', flight_surgeon: 'Send a report to the flight surgeon.' },
};

export default function Trends() {
  const { id = 'bp' } = useParams();
  const ind = byId[id] || byId.bp;
  const { rows, today, rules, environment, checkin } = useData();
  const [whyOpen, setWhyOpen] = useState(false);
  const s = indicatorStatus(ind.id, rows, today, rules, environment);
  const rule = rules.indicators.find((r) => r.id === ind.ruleId) || {};
  const actions = s.status !== 'normal' && rule.actions ? rule.actions : GENERIC[s.status];
  const b = s.baseline;
  const data = rows.filter((r) => r.day > today - 30 && r.day <= today).map((r) => ({ day: r.day, v: r[ind.field] }));
  const vals = data.map((d) => d.v).concat([b.mean - 2 * b.sd, b.mean + 2 * b.sd, ind.earthRef ?? b.mean]);
  const pad = (Math.max(...vals) - Math.min(...vals)) * 0.12 || 1;
  const domain = [Math.floor(Math.min(...vals) - pad), Math.ceil(Math.max(...vals) + pad)];
  const replaced = ind.id === 'bp' && checkin.bp && rows.find((r) => r.day === today)?.bp_rejected;

  return (
    <>
      <PageHeader back="/" title={<span className="row gap12">{ind.label} <StatusChip status={s.status} big /></span>}
        subtitle={ind.id === 'bp' && replaced ? `Re-measured ${s.row.bp_sys}/${s.row.bp_dia} mmHg · first reading ${replaced.sys}/${replaced.dia} replaced` : `Today ${ind.format(s.row)} ${ind.unit} · mission day ${today}`}
        right={<Link to="/body" className="btn"><Icon name="body" />See on body map</Link>} />

      <div className="row gap8 wrap" role="tablist" aria-label="Indicator">
        {TABS.map((t) => <Link key={t} to={`/trends/${t}`} role="tab" aria-selected={t === ind.id} className="tab">{byId[t].label}</Link>)}
      </div>

      <div className="split" style={{ '--cols': '1.3fr 1fr' }}>
        <div className="col gap16">
          <section className="panel col gap12" aria-label="Trend">
            <div className="row between"><h2 className="h2">{ind.id === 'bp' ? 'Systolic' : ind.label} · last 30 mission days</h2><span className="muted">{ind.unit}</span></div>
            <div style={{ height: 290 }} role="img" aria-label={`${ind.label} over the last 30 days compared with the personal baseline`}>
              <ResponsiveContainer>
                <LineChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: -8 }}>
                  <CartesianGrid stroke="#1F2A40" vertical={false} />
                  <XAxis dataKey="day" stroke="#8F9CB3" tickLine={false} fontSize={12} tickFormatter={(d) => `D${d}`} />
                  <YAxis stroke="#8F9CB3" domain={domain} tickLine={false} fontSize={12} />
                  <ReferenceArea y1={b.mean - 2 * b.sd} y2={b.mean + 2 * b.sd} fill="#10302D" fillOpacity={0.9} label={{ value: 'Your space baseline', position: 'insideBottomLeft', fill: '#6EE0D3', fontSize: 12 }} />
                  {ind.earthRef && <ReferenceLine y={ind.earthRef} stroke="#A3B0C6" strokeDasharray="6 5" label={{ value: ind.earthLabel, position: 'insideTopRight', fill: '#A3B0C6', fontSize: 12 }} />}
                  <Tooltip contentStyle={{ background: '#0E1626', border: '1px solid #2C3A57', borderRadius: 10 }} labelFormatter={(d) => `Mission day ${d}`} formatter={(v) => [`${v} ${ind.unit}`, ind.label]} />
                  <Line type="monotone" dataKey="v" stroke="#5B9CFF" strokeWidth={2.5} isAnimationActive animationDuration={1400}
                    dot={(p) => { const z = (p.payload.v - b.mean) / (b.sd || 1); const off = Math.abs(z) >= 2; return <Dot key={p.key} {...p} r={off ? 5 : 0} fill={off ? '#F5C451' : 'transparent'} stroke="none" />; }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {ind.earthRef && <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>An Earth rule would flag many of your normal days. AstroPulse compares against <strong style={{ color: 'var(--text)' }}>your own in-flight range</strong>, so a real change stands out.</p>}
          </section>

          <section className="panel col gap12" aria-label="What this means">
            <h2 className="h2">What this means</h2>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--text-2)' }}>
              <strong style={{ color: 'var(--text)' }}>{s.note}.</strong> Your baseline is {b.mean.toFixed(ind.id === 'temp' || ind.id === 'sleep' ? 1 : 0)} ± {b.sd.toFixed(1)} {ind.unit}. {rule.why_in_space}
            </p>
            <button type="button" className="tab" style={{ alignSelf: 'flex-start' }} aria-expanded={whyOpen} onClick={() => setWhyOpen(!whyOpen)}>
              <Icon name="book" size={16} style={{ marginRight: 8 }} />{whyOpen ? 'Hide sources' : 'Why? Show NASA sources'}
            </button>
            {whyOpen && (
              <div className="panel-inset col gap4" style={{ fontSize: 13, lineHeight: 1.5, color: '#B8C4D8', animation: 'fadeUp .3s ease both' }}>
                <span><strong style={{ color: 'var(--text)' }}>NASA hazards:</strong> {(rule.hazards || []).join(', ')}</span>
                {rule.source && <span><a href={rule.source.url} target="_blank" rel="noreferrer">{rule.source.title}</a></span>}
                <span className="faint">Rule: Watch when beyond 2 SD of your 14-day baseline for 3 days in a row{rule.act_limit ? `; Act at the hard limit ${JSON.stringify(rule.act_limit).replace(/[{}"]/g, '').replace(/_/g, ' ')}` : ''}.</span>
              </div>
            )}
          </section>
        </div>

        <section className="panel col gap12" aria-label="What to do">
          <h2 className="h2">What to do</h2>
          {[['Now · Self-care', actions.self_care], ['Tonight · Crew medical officer', actions.crew], ['Next · Flight surgeon', actions.flight_surgeon]].filter(([, t]) => t).map(([title, text], i) => (
            <div key={title} className="row gap12" style={{ alignItems: 'flex-start', border: i === 0 ? '2px solid var(--accent)' : '1px solid var(--line-2)', background: i === 0 ? 'var(--accent-soft)' : 'transparent', borderRadius: 16, padding: 16 }}>
              <span className="num" style={i === 0 ? { background: 'var(--accent)', color: 'var(--accent-ink)' } : {}}>{i + 1}</span>
              <div className="col gap4"><strong style={{ fontSize: 16 }}>{title}</strong><span style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5 }}>{text}</span></div>
            </div>
          ))}
          {s.status !== 'normal' && <span className="muted" style={{ fontSize: 13 }}>Flight surgeon replies take ~36 min round trip from here.</span>}
          <div className="row gap12" style={{ marginTop: 'auto' }}>
            <button type="button" className="btn grow">Preview report</button>
            <Link to="/health" className="btn btn-primary grow">Got it</Link>
          </div>
        </section>
      </div>
    </>
  );
}
