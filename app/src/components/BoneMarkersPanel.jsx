// Bone markers from the on-board prototype snapshot: serum CTX, serum P1NP and 24-hour urinary calcium.
// Display only. Every number here (baseline, latest, % change, slope, gaps, observations) comes
// from that snapshot; this component formats it and never adds thresholds or risk.
import { LineChart, Line, XAxis, YAxis, ReferenceLine, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Icon } from './ui.jsx';
import { API_BASE_URL } from '../api/config.js';

const META = {
  serum_ctx: { label: 'Serum CTX', what: 'Blood marker of bone breakdown', color: '#F5C451' },
  serum_p1np: { label: 'Serum P1NP', what: 'Blood marker of bone formation', color: '#6EE0D3' },
  urine_calcium_24h: { label: 'Urinary calcium (24 h)', what: 'Calcium leaving the body in urine', color: '#5B9CFF' },
};
const metaFor = (k) => META[k] ?? { label: k, what: '', color: '#A3B0C6' };
const words = (s) => (s ? String(s).replace(/_/g, ' ') : '');
const signed = (n) => (n > 0 ? `+${n}` : `${n}`);
const dayTxt = (d) => (d < 0 ? `L${d}` : `day ${d}`);

function Chip({ children, tone = 'muted' }) {
  const c = { muted: ['#1B2840', '#A3B0C6'], sim: ['#2A2410', '#F5C451'], ok: ['#10302D', '#6EE0D3'] }[tone];
  return <span style={{ background: c[0], color: c[1], borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{children}</span>;
}

function MarkerCard({ id, m }) {
  const meta = metaFor(id);
  const ok = m?.status === 'analyzed';
  return (
    <div className="card col gap8" style={{ cursor: 'default' }}>
      <div className="row between gap8"><span className="eyebrow">{meta.label}</span>{m?.sampleCount != null && <span className="faint">{m.sampleCount} samples</span>}</div>
      <span className="faint">{meta.what}</span>
      {ok ? (
        <>
          <div className="big-num">{m.latest} <small>{m.unit}</small></div>
          <span style={{ fontSize: 14, color: 'var(--text-2)' }}>Latest, {dayTxt(m.missionDay)}</span>
          <div className="row between wrap gap8" style={{ fontSize: 14 }}>
            <span className="muted">Baseline {m.baseline} {m.unit} ({dayTxt(m.baselineMissionDay)})</span>
            <strong style={{ color: 'var(--text)' }}>{signed(m.changePercent)}% vs baseline</strong>
          </div>
        </>
      ) : (
        <span style={{ fontSize: 14, color: 'var(--text-2)' }}>No comparison yet: {words(m?.status) || 'no data'}.</span>
      )}
    </div>
  );
}

function TrendChart({ id, t }) {
  const meta = metaFor(id);
  if (!t || t.status !== 'analyzed') {
    return (
      <div className="panel col gap8">
        <strong style={{ fontSize: 15 }}>{meta.label}</strong>
        <span className="faint">No trend: {words(t?.reason || t?.status) || 'no data'}{t?.sampleCount != null ? ` (${t.sampleCount} sample${t.sampleCount === 1 ? '' : 's'})` : ''}.</span>
      </div>
    );
  }
  return (
    <div className="panel col gap8" aria-label={`${meta.label} trend`}>
      <div className="row between wrap gap8"><strong style={{ fontSize: 15 }}>{meta.label}</strong><span className="muted">{t.unit}</span></div>
      <div style={{ height: 170 }} role="img" aria-label={`${meta.label}: ${t.points.map((p) => `${dayTxt(p.missionDay)} ${p.value}`).join(', ')} ${t.unit}`}>
        <ResponsiveContainer>
          <LineChart data={t.points} margin={{ top: 10, right: 22, bottom: 0, left: -6 }}>
            <CartesianGrid stroke="#1F2A40" vertical={false} />
            <XAxis dataKey="missionDay" type="number" domain={['dataMin', 'dataMax']} ticks={t.points.map((p) => p.missionDay)} interval={0} stroke="#8F9CB3" tickLine={false} fontSize={11} tickFormatter={(d) => (d < 0 ? `L${d}` : `D${d}`)} />
            <YAxis stroke="#8F9CB3" tickLine={false} fontSize={11} width={52} domain={['auto', 'auto']} padding={{ top: 12, bottom: 12 }} />
            <ReferenceLine y={t.baseline} stroke="#5D6B85" strokeDasharray="5 5" label={{ value: 'baseline', position: 'insideTopLeft', fill: '#8F9CB3', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#0E1626', border: '1px solid #2C3A57', borderRadius: 10 }} labelFormatter={(d) => dayTxt(d)} formatter={(v) => [`${v} ${t.unit}`, meta.label]} />
            <Line dataKey="value" stroke={meta.color} strokeWidth={3} dot={{ r: 4, fill: meta.color }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <span className="faint">Observed slope {signed(t.observedSlopePer30Days)} {t.unit} per 30 days · {signed(t.changePercentFromBaseline)}% since baseline{t.samplingGaps?.length ? ` · ${t.samplingGaps.length} sampling gap(s)` : ''}</span>
    </div>
  );
}

function List({ title, items, empty }) {
  return (
    <div className="col gap4">
      <span className="eyebrow">{title}</span>
      {items?.length ? <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.55, color: 'var(--text-2)' }}>{items.map((x) => <li key={x}>{x}</li>)}</ul>
        : <span className="faint">{empty}</span>}
    </div>
  );
}

export default function BoneMarkersPanel({ state, crewName }) {
  const { status, data, error, astronautId, retry } = state;
  const head = (
    <div className="row between wrap gap8">
      <div className="col gap4">
        <h2 className="h2">Bone markers</h2>
        <span className="muted">Prototype data in the app{data?.latestMissionDay != null ? ` · latest mission day ${data.latestMissionDay}` : ''}</span>
      </div>
      <div className="row gap8 wrap">
        {data?.dataSource && <Chip tone={data.dataSource === 'simulated' ? 'sim' : 'muted'}>{data.dataSource === 'simulated' ? 'Simulated data' : `Source: ${words(data.dataSource)}`}</Chip>}
        {data?.assessment?.status && <Chip>{words(data.assessment.status)}</Chip>}
        {status !== 'unmapped' && <button type="button" className="tab" onClick={retry} disabled={status === 'loading'}>{status === 'loading' ? 'Loading…' : 'Refresh'}</button>}
      </div>
    </div>
  );

  if (status === 'unmapped' || status === 'not_found') {
    return (
      <section className="panel col gap12" aria-label="Bone markers">
        {head}
        <span style={{ fontSize: 14, color: 'var(--text-2)' }}>
          {status === 'unmapped'
            ? <>No backend record is linked to {crewName} yet. Link one with <code>VITE_ASTRONAUT_MAP</code> in <code>app/.env.local</code>.</>
            : <>The backend has no bone-health record for {astronautId} yet.</>}
        </span>
      </section>
    );
  }
  if (status === 'error') {
    return (
      <section className="panel col gap12" aria-label="Bone markers" role="status">
        {head}
        <span className="row gap8" style={{ fontSize: 14, color: 'var(--warn)' }}><Icon name="info" size={18} />{error?.message || 'Could not load bone markers.'}</span>
        <span className="faint">Start it with <code>cd backend && npm run dev</code> (expected at {API_BASE_URL}). The rest of this page keeps working on on-board demo data.</span>
      </section>
    );
  }
  if (status === 'loading' && !data) {
    return <section className="panel col gap12" aria-label="Bone markers" aria-busy="true">{head}<span className="faint">Loading bone markers…</span></section>;
  }

  const markers = data.boneMarkers?.metrics ?? {};
  const trends = data.biomarkerTrends?.metrics ?? {};
  const ids = [...new Set([...Object.keys(META), ...Object.keys(markers), ...Object.keys(trends)])].filter((k) => markers[k] || trends[k]);
  const ctx = data.context;
  const s = ctx?.symptoms?.latest;
  const ex = ctx?.exercise;
  const a = data.assessment ?? {};

  return (
    <section className="panel col gap16" aria-label="Bone markers">
      {head}
      <span className="row gap8" style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-2)', alignItems: 'flex-start' }}>
        <Icon name="info" size={18} />
        <span>{a.note || data.boneMarkers?.note || 'These markers do not directly measure spinal bone density.'} The analysis is descriptive and not clinically validated.</span>
      </span>
      {data.missingSections?.length > 0 && <span className="faint">Not in this response: {data.missingSections.join(', ')}.</span>}

      {ids.length === 0 ? <span className="faint">No biomarker measurements yet.</span> : (
        <>
          <div className="phase-grid">{ids.map((k) => <MarkerCard key={k} id={k} m={markers[k]} />)}</div>
          <div className="phase-grid">{ids.map((k) => <TrendChart key={k} id={k} t={trends[k]} />)}</div>
        </>
      )}

      <div className="split" style={{ '--cols': '1fr 1fr' }}>
        <div className="col gap12">
          <span className="eyebrow">Symptoms and exercise (prototype summary)</span>
          <div className="table-wrap">
            <table className="data-table">
              <tbody>
                <tr><td>Back pain, latest report</td><td>{s ? `${s.backPainSeverity}/10 on ${dayTxt(s.missionDay)}` : 'No reports'}</td></tr>
                <tr><td>Posture change</td><td>{s ? (s.postureChange ? 'Reported' : 'Not reported') : '–'}</td></tr>
                <tr><td>Symptom reports</td><td>{ctx?.symptoms?.recordCount ?? 0}{ctx?.symptoms?.invalidRecordCount ? ` (${ctx.symptoms.invalidRecordCount} invalid)` : ''}</td></tr>
                <tr><td>Exercise adherence</td><td>{ex?.adherencePercent != null ? `${ex.adherencePercent}% (${ex.totalCompletedMinutes} of ${ex.totalPlannedMinutes} planned min, ${ex.recordCount} sessions)` : 'No exercise logs'}</td></tr>
              </tbody>
            </table>
          </div>
          {ctx?.note && <span className="faint">{ctx.note}</span>}
        </div>
        <div className="col gap12">
          <List title="Observations" items={a.observations} empty="No observations yet." />
          <List title="Data-quality warnings" items={a.dataQualityFlags} empty="None reported." />
          <List title="Missing data" items={a.missingData} empty="Nothing missing." />
        </div>
      </div>
    </section>
  );
}
