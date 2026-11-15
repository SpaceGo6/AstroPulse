// Spine bone-density tab: average density before (ground), during (in flight) and after the
// mission, the forecast, plain-language alerts with prevention, tracking (exercise, back pain,
// biomarkers), the fixed test schedule with cost, and a report packet for the ground doctors.
import { useEffect, useMemo, useState } from 'react';
import { ComposedChart, Line, XAxis, YAxis, ReferenceArea, ReferenceLine, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useData } from '../data/DataContext.jsx';
import { spineForecast, spinePhases, spineAlerts, spineSignals, recoveryPct, downlinkPacket, PREVENTION, PLAN_ORDER, LANDING_WATCH_LOSS_PCT, RESCAN_JUMP_PCT } from '../engine/spine.js';
import { canonical } from '../audit/audit.js';
import { sha256 } from '../audit/sha256.js';
import { Icon, PageHeader, StatusChip } from '../components/ui.jsx';
import BoneMarkersPanel from '../components/BoneMarkersPanel.jsx';
import UltrasoundAnalyzer from '../components/UltrasoundAnalyzer.jsx';
import { useBoneHealth } from '../api/useBoneHealth.js';

const KEY = (id) => `astropulse.spine.${id}`;
const EMPTY = { reports: [], scans: [], downlinks: [], imaging: [] };
const read = (k) => { try { return { ...EMPTY, ...(JSON.parse(localStorage.getItem(k)) ?? {}) }; } catch { return { ...EMPTY }; } };

// Shrink an uploaded image so it fits in on-board storage (longest side 640 px, JPEG).
function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Not an image'));
      img.onload = () => {
        const k = Math.min(1, 640 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
const pctTxt = (p) => `${p > 0 ? '+' : ''}${p.toFixed(1)}%`;
const g = (v) => v.toFixed(3);

function PhaseCard({ label, sub, avg, pct, note, tone }) {
  return (
    <div className="card" style={{ animation: 'fadeUp .5s ease both', borderColor: tone === 'watch' ? 'var(--warn-line)' : undefined }}>
      <span className="eyebrow">{label}</span>
      <div className="big-num">{g(avg)} <small>g/cm²</small></div>
      <div className="row between wrap gap8">
        <span className="muted">{sub}</span>
        {pct != null && <span style={{ fontWeight: 600, color: pct < -LANDING_WATCH_LOSS_PCT ? 'var(--warn)' : 'var(--text-2)' }}>{pctTxt(pct)} vs pre-flight</span>}
      </div>
      {note && <span className="faint">{note}</span>}
    </div>
  );
}

export default function Spine() {
  const { crew, rows, today, spine, nasa, log } = useData();
  const [store, setStore] = useState(() => read(KEY(crew.id)));
  useEffect(() => setStore(read(KEY(crew.id))), [crew.id]);
  const [storeError, setStoreError] = useState('');
  const save = (next) => { setStore(next); try { localStorage.setItem(KEY(crew.id), JSON.stringify(next)); setStoreError(''); } catch { setStoreError('On-board storage is full: this item is kept until you reload. Remove old images to make room.'); } };

  const boneHealth = useBoneHealth(crew.id); // lab markers from the AstroPulse backend
  const base = spine.crew[crew.id];
  const pre = base.baseline.lumbar_bmd;
  // scans entered on this tablet join the in-flight ultrasound series
  const confirmedScans = store.scans.filter((s) => !s.pending);
  const pending = store.scans.find((s) => s.pending && s.day === today);
  const crewSpine = useMemo(() => ({
    ...base,
    flight: { ...base.flight, ultrasound: [...base.flight.ultrasound.filter((u) => !confirmedScans.some((s) => s.day === u.day)), ...confirmedScans].sort((a, b) => a.day - b.day) },
  }), [base, confirmedScans]); // eslint-disable-line react-hooks/exhaustive-deps
  const landing = spine.landing_day;
  const f = spineForecast(rows, crewSpine, spine.model, today, landing);
  const ph = spinePhases(crewSpine, f, spine.model, today);
  const alerts = spineAlerts({ rows, crewSpine, forecast: f, today, reports: store.reports.filter((r) => r.day === today) });
  if (pending) {
    alerts.unshift({ id: 'rescan', status: 'watch', title: 'New scan is far from the forecast: re-scan',
      why: `${pending.test} ${g(pending.lumbar_bmd_est)} g/cm² (${pctTxt(pending.pct)}) vs expected ${pctTxt(f.todayPct)}. That is more than the device's usual error, so it is held until a re-scan confirms it.`,
      plan: ['rescan'] });
  }
  const signals = spineSignals({ rows, crewSpine, forecast: f, today });
  const overall = alerts.some((a) => a.status === 'act') ? 'act' : alerts.length ? 'watch' : 'normal';

  // timeline chart: ground scans → monthly ultrasound → today → landing → recovery
  const hl = spine.model.recovery_half_life_days;
  const chart = useMemo(() => {
    const pts = base.ground.filter((x) => x.test === 'DXA').map((x) => ({ x: `L${x.day}`, measured: +((x.lumbar_bmd / pre - 1) * 100).toFixed(2), kind: 'DXA (X-ray)' }));
    crewSpine.flight.ultrasound.filter((u) => u.day < today).forEach((u) => pts.push({ x: `D${u.day}`, measured: u.pct, kind: 'Ultrasound' }));
    pts.push({ x: 'Today', measured: f.todayPct, current: f.todayPct, target: f.todayPct, kind: 'Estimate (scan + exercise log)' });
    pts.push({ x: 'Landing', current: f.landingCurrentPct, target: f.landingTargetPct });
    pts.push({ x: 'R+6 mo', current: recoveryPct(f.landingCurrentPct, 182, hl), target: recoveryPct(f.landingTargetPct, 182, hl) });
    pts.push({ x: 'R+1 yr', current: recoveryPct(f.landingCurrentPct, 365, hl), target: recoveryPct(f.landingTargetPct, 365, hl) });
    return pts;
  }, [base, crewSpine, today, f, pre, hl]);
  const firstFlight = chart.find((p) => p.x.startsWith('D'))?.x || 'Today';

  // tracking numbers
  const fl = crewSpine.flight;
  const urine = fl.urine.filter((u) => u.day <= today);
  const blood = fl.blood.filter((b) => b.day <= today);
  const weeks = fl.weekly.filter((w) => w.day <= today);
  const lastWeek = weeks[weeks.length - 1];
  const week7 = rows.filter((r) => r.day > today - 7 && r.day <= today).reduce((a, r) => a + r.ex_resist_min, 0);
  const lb = blood[blood.length - 1];

  // back pain report
  const [pain, setPain] = useState(2);
  const [where, setWhere] = useState('low back');
  const [hunched, setHunched] = useState(false);
  const report = () => {
    const r = { day: today, pain, where, hunched, at: new Date().toISOString() };
    save({ ...store, reports: [...store.reports, r] });
    log('SPINE_SYMPTOM', { pain, where, hunched });
  };
  // imaging result
  const [test, setTest] = useState('Ultrasound');
  const [bmd, setBmd] = useState('');
  const [imgFile, setImgFile] = useState(null);
  const [imgError, setImgError] = useState('');
  const addScan = async (e) => {
    e.preventDefault();
    setImgError('');
    const v = bmd.trim() ? Number(bmd) : null;
    if (v != null && !(v > 0.4 && v < 2)) { setImgError('Spine density should be between 0.4 and 2 g/cm².'); return; }
    if (v == null && !imgFile) { setImgError('Enter the spine density the device reported.'); return; }
    let image = null;
    if (imgFile) {
      try { image = await shrinkImage(imgFile); } catch (err) { setImgError(err.message); return; }
    }
    const entry = { id: `${today}-${Date.now()}`, day: today, test, lumbar_bmd_est: v, image, imageName: imgFile?.name || null,
      imageHash: image ? sha256(image).slice(0, 16) : null, needsRead: v == null };
    const imaging = [...store.imaging, entry];
    setImgFile(null); e.target.reset?.(); setBmd('');
    if (v == null) {
      save({ ...store, imaging });
      log('IMAGING_ADDED', { test, lumbar_bmd: 'awaiting ground read', pct: '–', status: `image ${entry.imageHash}` });
      return;
    }
    const pct = +((v / pre - 1) * 100).toFixed(2);
    // a reading far from the forecast is held until a second scan agrees with it
    const agreesWithPending = pending && Math.abs(pending.pct - pct) <= RESCAN_JUMP_PCT;
    const far = Math.abs(pct - f.todayPct) > RESCAN_JUMP_PCT && !agreesWithPending;
    const scan = agreesWithPending
      ? { day: today, lumbar_bmd_est: +((v + pending.lumbar_bmd_est) / 2).toFixed(4), pct: +((pct + pending.pct) / 2).toFixed(2), test }
      : { day: today, lumbar_bmd_est: v, pct, test, pending: far };
    save({ ...store, imaging, scans: [...store.scans.filter((x) => x.day !== today), scan] });
    log('IMAGING_ADDED', { test, lumbar_bmd: v, pct, status: `${far ? 'held for re-scan' : agreesWithPending ? 'confirmed by re-scan' : 'accepted'}${image ? `, image ${entry.imageHash}` : ''}` });
  };
  // concept analyzer: the image (real) and the simulated AI result are kept together for ground review
  const saveAnalyzed = ({ image, imageName, imageHash, analysis }) => {
    const entry = { id: `${today}-${Date.now()}`, day: today, test: 'Ultrasound image', lumbar_bmd_est: null, image, imageName, imageHash,
      analysis: analysis && { status: analysis.status, label: analysis.label, estimate: analysis.estimate, comparison: analysis.comparison, quality: analysis.quality } };
    save({ ...store, imaging: [...store.imaging, entry] });
    log('ULTRASOUND_ANALYZED', { image: imageHash, result: analysis?.status, estimate: analysis?.estimate?.lumbarBmd ?? null });
  };
  // downlink to the ground doctors
  const queued = store.downlinks.filter((d) => d.day === today).slice(-1)[0];
  const sentIds = new Set(store.downlinks.flatMap((d) => d.imagingIds || []));
  const unsent = store.imaging.filter((m) => !sentIds.has(m.id));
  const send = () => {
    const packet = downlinkPacket({ crew, today, phases: ph, forecast: f, alerts, crewSpine, reports: store.reports.filter((r) => r.day > today - 7), signals, imaging: unsent });
    const hash = sha256(canonical(packet)).slice(0, 16);
    save({ ...store, downlinks: [...store.downlinks, { id: `${today}-${Date.now()}`, day: today, hash, at: new Date().toISOString(), packet, imagingIds: unsent.map((m) => m.id), notes: [] }] });
    log('SPINE_DOWNLINK', { alerts: alerts.length, packet_hash: hash });
  };
  // the ground team's notes come back up (uplink) and are saved with the report they answer
  const [noteFor, setNoteFor] = useState(null);
  const [noteText, setNoteText] = useState('');
  const saveNote = (id) => {
    const text = noteText.trim();
    if (!text) return;
    const note = { text, at: new Date().toISOString(), day: today };
    save({ ...store, downlinks: store.downlinks.map((d) => (d.id === id ? { ...d, notes: [...(d.notes || []), note] } : d)) });
    log('GROUND_NOTES_SAVED', { report_day: store.downlinks.find((d) => d.id === id)?.day, chars: text.length });
    setNoteText(''); setNoteFor(null);
  };
  const imgById = Object.fromEntries(store.imaging.map((m) => [m.id, m]));
  const download = () => {
    const blob = new Blob([JSON.stringify(queued.packet, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `spine-report-${crew.id}-day${today}.json`; a.click();
    URL.revokeObjectURL(a.href);
  };

  const nb = nasa.spine_bedrest_phases;
  const nbP = Object.fromEntries(nb.phases.map((p) => [p.key, p]));
  const wanted = new Set(alerts.flatMap((a) => a.plan));
  if (signals.find((x) => x.id === 'pain')?.on) wanted.add('back');
  const plans = [...PLAN_ORDER.filter((p) => wanted.has(p)), ...[...wanted].filter((p) => !PLAN_ORDER.includes(p))];
  const firstName = crew.name.replace('Cmdr. ', '').split(' ')[0];

  return (
    <>
      <PageHeader title="Spine bone health" subtitle={`${crew.name} · lumbar spine (L1–L4) · mission day ${today} of ${landing}`}
        right={<div className="row gap8 wrap"><StatusChip status={overall} big label={overall === 'normal' ? 'On track' : overall === 'act' ? 'Act now' : `${alerts.length} to watch`} />
          <button type="button" className="btn btn-primary" onClick={send}><Icon name="send" />{queued ? 'Send update' : 'Send to ground doctors'}</button></div>} />

      <section className="panel panel-accent col gap8" aria-live="polite">
        <strong style={{ fontSize: 17 }}>What this means for you, {firstName}</strong>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: 'var(--text-2)' }}>
          Your spine is <strong>{Math.abs(f.todayPct).toFixed(1)}% below</strong> your pre-flight scan. Some bone loss happens to every astronaut (about 1% a month without countermeasures); the goal is to slow it.
          {f.status === 'watch'
            ? <> At your current exercise pace you'd land at <strong>{pctTxt(f.landingCurrentPct)}</strong>. Getting back to 150 min a week of resistance exercise brings that to <strong>{pctTxt(f.landingTargetPct)}</strong>. That one change matters most.</>
            : <> You're on track: forecast at landing <strong>{pctTxt(f.landingCurrentPct)}</strong>. Keep doing what you're doing.</>}
          {' '}Your ground doctors see the same numbers.
        </p>
        {queued && <span className="row gap8" style={{ fontSize: 13, color: 'var(--ok)' }}><Icon name="check" size={16} />Report queued for the next comm window · hash {queued.hash} <button type="button" className="tab" style={{ minHeight: 34 }} onClick={download}><Icon name="download" size={16} />Packet</button></span>}
      </section>

      <section aria-label="Average spine density by phase" className="phase-grid">
        <PhaseCard label="Pre-flight · ground" avg={ph.ground.avg} sub={`${ph.ground.n} DXA scans (L-180, L-30)`} pct={(ph.ground.avg / pre - 1) * 100} note="X-ray DXA, the gold standard" />
        <PhaseCard label="In flight · mission" avg={ph.flight.avg} sub={`${ph.flight.n} ultrasound scans + today`} pct={(ph.flight.avg / pre - 1) * 100} note={`Today: ${g(f.todayBmd)} g/cm² (${pctTxt(f.todayPct)})`} />
        <PhaseCard label="Post-flight · projected" avg={ph.post.avg} sub="Landing, +6 months, +1 year" pct={(ph.post.avg / pre - 1) * 100} tone={f.status}
          note={`Landing ${g(f.landingCurrentBmd)} → +1 yr ${g(ph.post.points[2].bmd)} g/cm² (DXA after landing confirms)`} />
      </section>

      <section className="split" style={{ '--cols': '1.55fr 1fr' }}>
        <div className="col gap16">
        <section className="panel col gap12" aria-label="Spine density timeline">
          <div className="row between wrap gap8"><h2 className="h2">Spine density, % vs pre-flight</h2><span className="muted">Ground → flight → recovery</span></div>
          <div style={{ height: 300 }} role="img" aria-label={`Spine timeline. Today ${f.todayPct}%. Landing at current pace ${f.landingCurrentPct}%, on target ${f.landingTargetPct}%.`}>
            <ResponsiveContainer>
              <ComposedChart data={chart} margin={{ top: 16, right: 12, bottom: 4, left: -10 }}>
                <CartesianGrid stroke="#1F2A40" vertical={false} />
                <ReferenceArea x1="L-180" x2="L-30" fill="#142440" fillOpacity={0.5} label={{ value: 'Ground', position: 'insideTop', fill: '#8DB8FF', fontSize: 11 }} />
                <ReferenceArea x1={firstFlight} x2="Today" fill="#10302D" fillOpacity={0.35} label={{ value: 'In flight', position: 'insideTop', fill: '#6EE0D3', fontSize: 11 }} />
                <ReferenceArea x1="Landing" x2="R+1 yr" fill="#1B2840" fillOpacity={0.6} label={{ value: 'Post-flight', position: 'insideTop', fill: '#A3B0C6', fontSize: 11 }} />
                <XAxis dataKey="x" stroke="#8F9CB3" tickLine={false} fontSize={11} interval={0} />
                <YAxis domain={[-4, 1]} stroke="#8F9CB3" tickLine={false} fontSize={12} tickFormatter={(v) => `${v}%`} />
                <ReferenceLine y={-LANDING_WATCH_LOSS_PCT} stroke="#F5C451" strokeDasharray="6 5" label={{ value: `Watch −${LANDING_WATCH_LOSS_PCT}%`, position: 'insideBottomLeft', fill: '#F5C451', fontSize: 11 }} />
                <ReferenceLine y={0} stroke="#2C3A57" />
                <Tooltip contentStyle={{ background: '#0E1626', border: '1px solid #2C3A57', borderRadius: 10 }}
                  formatter={(v, n, item) => [`${v}% · ${g(pre * (1 + v / 100))} g/cm²`, { measured: item?.payload?.kind || 'Measured', current: 'Current pace', target: 'On exercise target' }[n]]} />
                <Line dataKey="measured" stroke="#5B9CFF" strokeWidth={3} dot={{ r: 4, fill: '#5B9CFF' }} isAnimationActive={false} connectNulls />
                <Line dataKey="current" stroke="#F5C451" strokeWidth={3} strokeDasharray="7 6" dot={false} isAnimationActive={false} connectNulls />
                <Line dataKey="target" stroke="#6EE0D3" strokeWidth={3} strokeDasharray="7 6" dot={false} isAnimationActive={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="row gap16 faint wrap" style={{ fontSize: 13 }}>
            <span style={{ color: '#5B9CFF' }}>● scans (DXA on the ground, ultrasound in flight)</span><span style={{ color: '#F5C451' }}>┅ current pace</span><span style={{ color: '#6EE0D3' }}>┅ on exercise target</span>
          </div>
          <span className="faint">Between scans the estimate moves with your exercise log. After landing: NASA recovery fit (half-life {hl} days); real recovery is often incomplete.</span>
        </section>
          {plans.length > 0 && (
            <div className="panel col gap12" aria-label="What to do">
              <strong style={{ fontSize: 16 }}>What to do{plans.some((p) => PLAN_ORDER.includes(p)) ? ', in this order' : ''}</strong>
              {plans.map((p) => (
                <div key={p} className="col gap4">
                  <span className="eyebrow">{PREVENTION[p].step ? `Step ${PREVENTION[p].step} · ` : ''}{PREVENTION[p].title}</span>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.55, color: 'var(--text-2)' }}>{PREVENTION[p].items.map((i) => <li key={i}>{i}</li>)}</ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <section className="col gap12 first-when-stacked" aria-label="Alerts and prevention">
          {alerts.length === 0 && <div className="panel row gap12"><StatusChip status="normal" big /><span style={{ color: 'var(--text-2)' }}>No spine alerts. Keep the routine.</span></div>}
          {alerts.map((a) => (
            <div key={a.id} className={`card is-${a.status}`} style={{ cursor: 'default' }}>
              <div className="row between gap8"><strong style={{ fontSize: 15 }}>{a.title}</strong><StatusChip status={a.status} /></div>
              <span style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-2)' }}>{a.why}</span>
            </div>
          ))}
          <div className="panel col gap10" aria-label="Bone signals">
            <strong style={{ fontSize: 15 }}>Bone signals we combine</strong>
            {signals.map((x) => (
              <div key={x.id} className="row gap10" style={{ alignItems: 'flex-start' }}>
                <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 5, marginTop: 6, flexShrink: 0, background: x.on ? 'var(--warn)' : 'var(--ok)' }} />
                <span className="col" style={{ fontSize: 14, lineHeight: 1.45 }}>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{x.label} · {x.on ? 'outside your range' : 'in your range'}</span>
                  <span className="faint">{x.detail}</span>
                </span>
              </div>
            ))}
            <span className="faint">One signal alone is not an alert. Two or more pointing the same way raise the bone-loss pattern alert.</span>
          </div>
        </section>
      </section>

      <section className="split" style={{ '--cols': '1fr 1fr' }}>
        <section className="panel col gap12" aria-label="Tracking">
          <h2 className="h2">Tracking</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Measure</th><th>Latest</th><th>Your usual</th></tr></thead>
              <tbody>
                <tr><td>Resistance exercise</td><td>{week7} min this week</td><td>Target 150 / week · last 4 weeks {f.adherencePct}%</td></tr>
                <tr><td>Back pain (0–10)</td><td>{lastWeek ? `${lastWeek.pain_avg} avg, max ${lastWeek.pain_max} (week ${lastWeek.week})` : '–'}</td><td>{(weeks.filter((w) => w.week >= 3 && w.week <= 12).reduce((a, w) => a + w.pain_avg, 0) / 10).toFixed(1)} avg</td></tr>
                <tr><td>Hunched posture</td><td>{lastWeek ? `${lastWeek.hunched_days} of 7 days` : '–'}</td><td>Self-check in the daily check-in</td></tr>
                {boneHealth.status === 'ready' ? (
                  <tr><td>Lab markers</td><td colSpan={2}>From the backend: see Bone markers below</td></tr>
                ) : (<>
                <tr><td colSpan={3} className="faint">Lab values below are on-board demo data (backend not connected)</td></tr>
                <tr><td>Urine NTx (bone breakdown)</td><td>{urine.slice(-1)[0]?.ntx} on day {urine.slice(-1)[0]?.day}</td><td>Pre-flight {base.baseline.ntx}</td></tr>
                <tr><td>Urine calcium</td><td>{urine.slice(-1)[0]?.calcium} mg/day</td><td>Pre-flight {base.baseline.urine_calcium}</td></tr>
                <tr><td>Blood calcium</td><td>{lb?.calcium} mg/dL</td><td>{9.4} mg/dL</td></tr>
                <tr><td>BSAP (bone building)</td><td>{lb?.bsap} U/L</td><td>Pre-flight {base.baseline.bsap}</td></tr>
                <tr><td>Vitamin D</td><td style={{ color: lb?.vitd < 30 ? 'var(--warn)' : undefined }}>{lb?.vitd} ng/mL</td><td>Pre-flight {base.baseline.vitd}</td></tr>
                </>)}
              </tbody>
            </table>
          </div>
        </section>

        <section className="col gap16">
          <div className="panel col gap12" aria-label="Report back pain">
            <h2 className="h2">Report back pain or posture</h2>
            <div className="row gap12 wrap">
              <label className="col gap4 grow" style={{ minWidth: 160 }}><span className="muted">Pain now: <strong style={{ color: pain >= 7 ? 'var(--bad-text)' : 'var(--text)' }}>{pain}/10</strong></span>
                <input className="slider" type="range" min={0} max={10} value={pain} onChange={(e) => setPain(Number(e.target.value))} /></label>
              <label className="col gap4"><span className="muted">Where</span>
                <select className="field" value={where} onChange={(e) => setWhere(e.target.value)}>{['low back', 'mid back', 'neck', 'leg (spreading)'].map((w) => <option key={w}>{w}</option>)}</select></label>
            </div>
            <label className="row gap8" style={{ fontSize: 14 }}><input type="checkbox" checked={hunched} onChange={(e) => setHunched(e.target.checked)} style={{ width: 20, height: 20 }} />Hunched / stooped posture today</label>
            <button type="button" className="btn" onClick={report}>Save report</button>
            {store.reports.filter((r) => r.day === today).length > 0 && <span className="faint">{store.reports.filter((r) => r.day === today).length} report(s) today · in the audit trail</span>}
          </div>
          <form className="panel col gap12" aria-label="Add imaging result" onSubmit={addScan}>
            <h2 className="h2">Enter device reading</h2>
            <div className="row gap12 wrap">
              <select className="field" value={test} onChange={(e) => setTest(e.target.value)} aria-label="Imaging type">{['Ultrasound', 'DXA', 'CT (QCT)'].map((t) => <option key={t}>{t}</option>)}</select>
              <input className="field grow" style={{ minWidth: 140 }} inputMode="decimal" placeholder={`Spine g/cm², e.g. ${g(f.todayBmd)}`} value={bmd} onChange={(e) => setBmd(e.target.value)} aria-label="Spine bone density in g/cm²" />
              <button type="submit" className="btn">Add</button>
            </div>
            {imgError && <span role="alert" style={{ color: 'var(--warn)', fontSize: 14 }}>{imgError}</span>}
            {storeError && <span role="alert" style={{ color: 'var(--warn)', fontSize: 14 }}>{storeError}</span>}
            <span className="faint">The spine density the ultrasound device reports. Saved on board and sent with the next report. A big jump asks for a re-scan before it changes the forecast.</span>
          </form>
        </section>
      </section>

      <UltrasoundAnalyzer crew={crew} today={today} onSave={saveAnalyzed} />

      <BoneMarkersPanel state={boneHealth} crewName={firstName} />

      <section className="panel col gap12" aria-label="Ground review">
        <div className="row between wrap gap8"><h2 className="h2">Ground review</h2><span className="muted">Saved on board → downlink → doctor's notes → uplink</span></div>
        <span style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-2)' }}>Everything stays saved on the tablet. Reports and images go to the ground doctors at the next communication window. Their notes come back up and are saved next to the data they refer to, so the record builds up for pattern analysis.</span>
        {unsent.length > 0 && <span className="faint">{unsent.length} image(s) waiting for the next report.</span>}
        {store.downlinks.length === 0 && <span className="faint">No reports yet. Use “Send to ground doctors” at the top of this page.</span>}
        {[...store.downlinks].reverse().map((d) => (
          <div key={d.id || d.hash} className="card col gap8" style={{ cursor: 'default' }}>
            <div className="row between wrap gap8">
              <strong style={{ fontSize: 15 }}>Report, mission day {d.day}</strong>
              <StatusChip status={(d.notes || []).length ? 'normal' : 'watch'} label={(d.notes || []).length ? 'Doctor’s notes received' : 'Waiting for ground notes'} />
            </div>
            <span className="faint">{d.packet.alerts.length} alert(s) · {(d.imagingIds || []).length} image(s) · tamper-check {d.hash}</span>
            {(d.imagingIds || []).some((id) => imgById[id]?.image) && (
              <div className="row gap8 wrap">{(d.imagingIds || []).map((id) => imgById[id]?.image && (
                <figure key={id} className="col gap4" style={{ margin: 0 }}>
                  <img src={imgById[id].image} alt={`${imgById[id].test}, day ${imgById[id].day}`} style={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line-2)' }} />
                  {imgById[id].analysis?.estimate && <figcaption className="faint" style={{ fontSize: 11, maxWidth: 120 }}>Simulated AI: {imgById[id].analysis.estimate.lumbarBmd} g/cm²</figcaption>}
                </figure>
              ))}</div>
            )}
            {(d.notes || []).map((n, i) => (
              <div key={i} className="col gap4" style={{ background: 'var(--panel-2)', borderRadius: 10, padding: '10px 12px' }}>
                <span className="eyebrow">From the ground medical team · day {n.day}</span>
                <span style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text)', whiteSpace: 'pre-line' }}>{n.text}</span>
              </div>
            ))}
            {noteFor === (d.id || d.hash) ? (
              <div className="col gap8">
                <label className="col gap4"><span className="muted">Doctor’s notes received by uplink</span>
                  <textarea className="field" rows={3} style={{ padding: 10, minHeight: 80 }} value={noteText} onChange={(e) => setNoteText(e.target.value)} /></label>
                <div className="row gap8"><button type="button" className="btn" onClick={() => saveNote(d.id)}>Save notes</button><button type="button" className="tab" onClick={() => setNoteFor(null)}>Cancel</button></div>
              </div>
            ) : (
              d.id && <button type="button" className="tab" style={{ alignSelf: 'flex-start' }} onClick={() => { setNoteFor(d.id); setNoteText(''); }}>Add doctor’s notes</button>
            )}
          </div>
        ))}
      </section>

      <section className="panel col gap12" aria-label="Test schedule">
        <div className="row between wrap gap8"><h2 className="h2">Test schedule (same interval, same time, same position)</h2><span className="muted">$ low · $$ medium · $$$ high</span></div>
        <div className="table-wrap">
          <table className="data-table" style={{ minWidth: 760 }}>
            <thead><tr><th>Test</th><th>Where</th><th>When</th><th>Shows</th><th>Radiation</th><th>Cost</th><th>Crew time</th></tr></thead>
            <tbody>{spine.schedule.map((s) => (
              <tr key={s.id}><td style={{ color: 'var(--text)', fontWeight: 600 }}>{s.test}</td><td>{s.phase === 'ground' ? 'Ground' : 'In flight'}</td><td>{s.when}</td><td>{s.shows}</td><td>{s.radiation}</td><td>{s.cost}</td><td>{s.crew_min ? `${s.crew_min} min` : 'auto'}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <span className="faint">X-ray and CT machines are too big to fly, so they stay on the ground. In flight we track with radiation-free ultrasound, urine and blood, and daily symptoms.</span>
      </section>

      <section className="panel col gap8" aria-label="NASA evidence" style={{ fontSize: 13, lineHeight: 1.55, color: '#B8C4D8' }}>
        <strong style={{ color: 'var(--text)', fontSize: 14 }}>Real NASA data: spine density before, during and after ~60 days of bed rest (Earth stand-in for weightlessness)</strong>
        <div className="table-wrap">
          <table className="data-table" style={{ minWidth: 520 }}>
            <thead><tr><th>Phase</th><th>People</th><th>Lumbar spine, same people</th><th>Change</th></tr></thead>
            <tbody>
              {['mission', 'post', 'post_6mo', 'post_1y'].map((k) => nbP[k] && (
                <tr key={k}><td>{nbP[k].label}</td><td>{nbP[k].lumbar_paired.n}</td><td>{g(nbP[k].lumbar_paired.ground_mean)} → {g(nbP[k].lumbar_paired.phase_mean)} g/cm²</td><td>{pctTxt(nbP[k].lumbar_pct.mean)} (±{nbP[k].lumbar_pct.sd})</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <span>Ground average, all {nbP.ground.lumbar_bmd.n} people: {g(nbP.ground.lumbar_bmd.mean)} g/cm². 30-day bed rest with dedicated spine scans (n={nb.pilot_30_day.n}): {pctTxt(nb.pilot_30_day.pct_change_mean)}.</span>
        <span>Real spaceflight is faster: about 1% per month at the lumbar spine (NASA DXA, LeBlanc 2000; Lang 2004: 0.9%/month).</span>
        <span className="faint">Source: NASA Life Sciences Data Archive, study MR035G (spine regions of whole-body DXA, so values vary more than a dedicated spine scan). Crew data on this page is simulated. Prototype, not a medical device: the ground medical team decides.</span>
      </section>
    </>
  );
}
