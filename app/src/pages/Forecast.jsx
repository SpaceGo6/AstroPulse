// Forecast with a time-jump slider: bone density to landing (current pace vs on target),
// radiation dose, and the real NASA bed-rest evidence behind the bone rate.
import { useMemo, useState } from 'react';
import { ComposedChart, Line, XAxis, YAxis, ReferenceArea, ReferenceLine, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useData } from '../data/DataContext.jsx';
import { boneForecast, radiationStatus } from '../engine/engine.js';
import { PageHeader, StatusChip } from '../components/ui.jsx';

export default function Forecast() {
  const { rows, today, rules, environment, nasa } = useData();
  const [day, setDay] = useState(today);
  const landing = rows[rows.length - 1].day;
  const f = boneForecast(rows, day, rules, landing);
  const rad = radiationStatus(environment, day, rules);

  // measured history up to the chosen day, then two straight-line projections to landing
  const series = useMemo(() => rows.map((r) => {
    const p = { day: r.day };
    if (r.day <= day) p.measured = r.bone_pct_est;
    if (r.day >= day) {
      const frac = (r.day - day) / (landing - day || 1);
      p.current = +(f.today + (f.landingCurrent - f.today) * frac).toFixed(2);
      p.target = +(f.today + (f.landingOnTarget - f.today) * frac).toFixed(2);
    }
    return p;
  }), [rows, day, landing, f.today, f.landingCurrent, f.landingOnTarget]);

  const phase = day < 100 ? 'routine' : day <= 125 ? 'busy mission phase' : day <= today ? 'recovering' : 'future (forecast)';
  const c3 = nasa.c3_bedrest_summary;
  const pilot = nasa.dxa_bedrest_summary.sites.pelvis;
  const ref = nasa.dxa_screening_reference;

  return (
    <>
      <PageHeader title="Where your body is heading" subtitle="Drag through the mission to see the past and the forecast to landing" />
      <div className="split" style={{ '--cols': '1.55fr 1fr' }}>
        <section className="panel col gap12" aria-label="Bone density forecast">
          <div className="row between"><h2 className="h2">Bone density, % of your pre-flight scan</h2><span className="muted">Mission days 1–{landing}</span></div>
          <div style={{ height: 320 }} role="img" aria-label={`Bone forecast: at current pace ${f.landingCurrent}% at landing, on exercise target ${f.landingOnTarget}%. Watch level ${f.watchLevel}%.`}>
            <ResponsiveContainer>
              <ComposedChart data={series} margin={{ top: 12, right: 16, bottom: 4, left: -6 }}>
                <CartesianGrid stroke="#1F2A40" vertical={false} />
                <XAxis dataKey="day" type="number" domain={[1, landing]} ticks={[1, 30, 60, 90, 120, 150, landing]} stroke="#8F9CB3" tickLine={false} fontSize={12} tickFormatter={(d) => (d === landing ? 'Landing' : `D${d}`)} />
                <YAxis domain={[96.5, 100.2]} stroke="#8F9CB3" tickLine={false} fontSize={12} tickFormatter={(v) => `${v}%`} />
                <ReferenceArea x1={100} x2={125} fill="#3A2D0F" fillOpacity={0.6} label={{ value: 'Busy phase', position: 'insideTop', fill: '#F5C451', fontSize: 11 }} />
                <ReferenceLine y={f.watchLevel} stroke="#F5C451" strokeDasharray="6 5" label={{ value: `Watch level · ${(100 - f.watchLevel).toFixed(1)}% loss`, position: 'insideBottomLeft', fill: '#F5C451', fontSize: 12 }} />
                <ReferenceLine x={day} stroke="#8DB8FF" strokeWidth={1.5} />
                <Tooltip contentStyle={{ background: '#0E1626', border: '1px solid #2C3A57', borderRadius: 10 }} labelFormatter={(d) => `Mission day ${d}`} formatter={(v, n) => [`${v}%`, { measured: 'Measured trend', current: 'Current pace', target: 'On exercise target' }[n]]} />
                <Line dataKey="measured" stroke="#5B9CFF" strokeWidth={3} dot={false} isAnimationActive={false} />
                <Line dataKey="current" stroke="#F5C451" strokeWidth={3} strokeDasharray="7 6" dot={false} isAnimationActive={false} />
                <Line dataKey="target" stroke="#6EE0D3" strokeWidth={3} strokeDasharray="7 6" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="row gap16 faint wrap" style={{ fontSize: 13 }}>
            <span style={{ color: '#5B9CFF' }}>━ measured</span><span style={{ color: '#F5C451' }}>┅ current pace</span><span style={{ color: '#6EE0D3' }}>┅ on exercise target</span>
          </div>
          <div className="row between wrap gap8">
            <label htmlFor="day-slider" style={{ fontSize: 15, fontWeight: 600 }}>Time-jump: <span style={{ color: 'var(--link)' }}>day {day}</span> · {phase}</label>
            <div className="row gap8">
              {[[110, 'Day 110'], [today, `Today · ${today}`], [landing - 1, `Landing · ${landing}`]].map(([d, l]) => (
                <button key={l} type="button" className="tab" aria-pressed={day === d} onClick={() => setDay(d)}>{l}</button>
              ))}
            </div>
          </div>
          <input id="day-slider" className="slider" type="range" min={30} max={landing - 1} value={day} onChange={(e) => setDay(Number(e.target.value))} />
        </section>

        <div className="col gap16">
          <section className="panel col gap12" aria-live="polite" aria-label="Selected day">
            <div className="row between"><span className="muted" style={{ fontWeight: 600 }}>Day {day} · {day <= today ? 'measured trend' : 'forecast'}</span><StatusChip status={f.status} big label={`Landing: ${f.status === 'watch' ? 'Watch' : 'Normal'}`} /></div>
            <div style={{ fontFamily: 'var(--display)', fontSize: 44, fontWeight: 600 }}>{f.today.toFixed(1)}<span style={{ fontSize: 18, color: 'var(--muted)', fontWeight: 500 }}> % of pre-flight</span></div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--text-2)' }}>
              Last 4 weeks you did <strong>{f.adherencePct}%</strong> of your resistance-exercise target, so you'd land at <strong>{f.landingCurrent}%</strong>. Back on target you'd land at <strong>{f.landingOnTarget}%</strong>.
            </p>
          </section>
          <section className="panel panel-accent col gap8">
            <strong style={{ fontSize: 16 }}>What bends the curve back</strong>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: 'var(--text-2)' }}>
              <li>Get back to {f.targetMin} min of resistance exercise a week (this week: {f.weekResistMin})</li>
              <li>Water above 2 L a day (bone calcium raises kidney-stone risk)</li>
            </ul>
          </section>
          <section className="panel col gap8" aria-label="Radiation">
            <div className="row between" style={{ fontSize: 14 }}><span className="muted" style={{ fontWeight: 600 }}>Radiation at day {day}</span><span style={{ fontWeight: 600 }}>{Math.round(rad.cum)} mSv · {rad.pct}% of {rad.limit}</span></div>
            <div style={{ height: 10, borderRadius: 5, background: 'var(--line)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(100, rad.pct)}%`, background: rad.solarNow ? 'var(--bad)' : 'var(--link)', transition: 'width .2s' }} /></div>
            {rad.solarNow && <span style={{ color: 'var(--bad-text)', fontSize: 13, fontWeight: 600 }}>Solar particle event: move to the storm shelter</span>}
          </section>
          <section className="panel col gap8" aria-label="NASA evidence" style={{ fontSize: 13, lineHeight: 1.5, color: '#B8C4D8' }}>
            <strong style={{ color: 'var(--text)', fontSize: 14 }}>Real NASA evidence (bed rest = Earth stand-in for weightlessness)</strong>
            <span>60-day bed rest, n={c3.participants}: pelvis {c3.pelvis_bmd_pct_per_30_days_in_bedrest}% per 30 days; lean mass {c3.phases.end_of_bedrest.lean_mass_pct.mean}% by the end.</span>
            <span>30-day bed rest, n={pilot.n}: pelvis {pilot.mean_pct_change}%.</span>
            <span>Healthy reference, n={ref.volunteers}: total hip {ref.total_hip_bmd.mean} g/cm².</span>
            <span className="faint">Source: NASA Life Sciences Data Archive, study MR035G. Forecast rate: NASA HRP. Simulated crew data.</span>
          </section>
        </div>
      </div>
    </>
  );
}
