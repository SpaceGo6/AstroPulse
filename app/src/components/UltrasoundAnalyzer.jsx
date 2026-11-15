// Ultrasound analyzer: CONCEPT DEMO of how a future AI model would read spine ultrasound images.
// Real: the image checks in the browser (brightness, contrast, sharpness) and saving the image
// for ground review. Simulated: the density estimate, from static prototype data in the app.
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Icon } from './ui.jsx';
import { imageStats } from '../api/imageStats.js';
import { analyzeUltrasoundDemo, ultrasoundTrend, ULTRASOUND_LABEL } from '../api/ultrasoundDemo.js';

const SAMPLE = `${import.meta.env.BASE_URL ?? '/'}samples/spine-ultrasound-sample.png`;
const dayTxt = (d) => (d < 0 ? `L${d}` : `day ${d}`);
const signed = (n) => (n > 0 ? `+${n}` : `${n}`);
const unitTxt = (u) => (u === 'g/cm2' ? 'g/cm²' : u);

function ConceptChip() {
  return <span style={{ background: '#2A2410', color: '#F5C451', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>Concept demo · simulated AI</span>;
}

export default function UltrasoundAnalyzer({ crew, today, onSave }) {
  const [img, setImg] = useState(null);         // { dataUrl, stats…, name }
  const [busy, setBusy] = useState('');         // '' | 'reading' | 'analyzing'
  const [stage, setStage] = useState(-1);       // pipeline step being shown
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState({ status: 'ready', trend: ultrasoundTrend(crew.id), label: ULTRASOUND_LABEL });
  const [saved, setSaved] = useState(false);

  const pick = async (fileOrUrl, name) => {
    setError(''); setResult(null); setSaved(false); setStage(-1); setBusy('reading');
    try { setImg({ ...(await imageStats(fileOrUrl)), name }); } catch (e) { setImg(null); setError(e.message); }
    setBusy('');
  };

  const analyze = async () => {
    if (!img) return;
    setError(''); setResult(null); setSaved(false); setBusy('analyzing'); setStage(0);
    try {
      const r = analyzeUltrasoundDemo({ crewId: crew.id, missionDay: today, image: img });
      for (let i = 1; i <= r.pipeline.length; i += 1) { await new Promise((ok) => setTimeout(ok, 380)); setStage(i); }
      setResult(r);
      if (r.status === 'estimated') setHistory({ status: 'ready', trend: ultrasoundTrend(crew.id), label: ULTRASOUND_LABEL });
    } catch (e) { setError(e.message); setStage(-1); }
    setBusy('');
  };

  const save = () => {
    onSave({ image: img.dataUrl, imageName: img.name, imageHash: img.sha256.slice(0, 16), analysis: result });
    setSaved(true);
  };

  const steps = result?.pipeline ?? [
    { step: 'Image quality check' }, { step: 'Find lumbar vertebrae L1–L4' }, { step: 'Estimate bone density' }, { step: "Compare with this astronaut's history" },
  ];
  const t = history.trend;

  return (
    <section className="panel col gap16" aria-label="Ultrasound analyzer">
      <div className="row between wrap gap8">
        <div className="col gap4"><h2 className="h2">Ultrasound analyzer</h2><span className="muted">How a future AI model would read spine ultrasound on board</span></div>
        <ConceptChip />
      </div>
      <span className="row gap8" style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-2)', alignItems: 'flex-start' }}>
        <Icon name="info" size={18} />
        <span>The image checks are real. The density estimate is <strong>simulated</strong> from prototype data in the app. It is not a measurement and does not feed the forecast. The ground doctors check every result against the device reading.</span>
      </span>

      <div className="split" style={{ '--cols': '1fr 1fr' }}>
          <div className="col gap12">
            <div className="row gap8 wrap">
              <label className="btn" style={{ cursor: 'pointer' }}>
                <Icon name="upload" size={18} />Upload ultrasound image
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f, f.name); e.target.value = ''; }} />
              </label>
              <button type="button" className="tab" onClick={() => pick(SAMPLE, 'spine-ultrasound-sample.png')}>Use sample image</button>
            </div>
            {busy === 'reading' && <span className="faint">Checking image…</span>}
            {img && (
              <>
                <img src={img.dataUrl} alt={`Uploaded spine ultrasound: ${img.name}`} style={{ width: '100%', maxHeight: 260, objectFit: 'contain', background: '#000', borderRadius: 12, border: '1px solid var(--line-2)' }} />
                <div className="row gap8 wrap" style={{ fontSize: 13 }}>
                  <span className="chip-stat">{img.width}×{img.height}px</span>
                  <span className="chip-stat">Brightness {img.brightness}</span>
                  <span className="chip-stat">Contrast {img.contrast}</span>
                  <span className="chip-stat">Sharpness {img.sharpness}</span>
                </div>
                <button type="button" className="btn btn-primary" onClick={analyze} disabled={busy !== ''}>
                  {busy === 'analyzing' ? 'Analyzing…' : 'Analyze image (concept)'}
                </button>
              </>
            )}
            {error && <span role="alert" style={{ fontSize: 14, color: 'var(--warn)' }}>{error}</span>}
          </div>

          <div className="col gap12" aria-live="polite">
            {stage >= 0 && (
              <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {steps.map((s, i) => {
                  const done = i < stage;
                  const state = done ? (s.status || 'done') : i === stage ? 'running' : 'waiting';
                  const color = state === 'failed' ? 'var(--warn)' : done ? 'var(--ok)' : 'var(--muted)';
                  return (
                    <li key={s.step} className="row gap8" style={{ fontSize: 14, color: 'var(--text-2)' }}>
                      <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 5, background: color, flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{s.step}</span>
                      <span style={{ color, fontSize: 12, fontWeight: 600 }}>{state}</span>
                    </li>
                  );
                })}
              </ol>
            )}

            {result?.status === 'rescan_needed' && (
              <div className="card is-watch col gap8" style={{ cursor: 'default' }}>
                <strong>Re-scan needed</strong>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: 'var(--text-2)' }}>{result.quality.issues.map((x) => <li key={x}>{x}</li>)}</ul>
                <span className="faint">{result.nextStep}</span>
              </div>
            )}

            {result?.status === 'estimated' && (
              <div className="card col gap10" style={{ cursor: 'default', borderColor: '#5B4A1A' }}>
                <span className="eyebrow" style={{ color: '#F5C451' }}>{result.label}</span>
                <div className="big-num">{result.estimate.lumbarBmd} <small>{unitTxt(result.estimate.unit)}</small></div>
                <span className="muted">Simulated L1–L4 estimate, range {result.estimate.low}–{result.estimate.high} {unitTxt(result.estimate.unit)}</span>
                <div className="row gap8 wrap">
                  {result.regions.map((r) => <span key={r.name} className="chip-stat">{r.name} {r.lumbarBmd}</span>)}
                </div>
                <div className="col gap4" style={{ fontSize: 14, color: 'var(--text-2)' }}>
                  {result.comparison?.previous && <span>vs previous scan ({dayTxt(result.comparison.previous.missionDay)}): <strong style={{ color: 'var(--text)' }}>{signed(result.comparison.previous.changePercent)}%</strong></span>}
                  {result.comparison?.baseline && <span>vs pre-flight ({dayTxt(result.comparison.baseline.missionDay)}): <strong style={{ color: 'var(--text)' }}>{signed(result.comparison.baseline.changePercent)}%</strong></span>}
                </div>
                <span className="faint">{result.nextStep}</span>
                <button type="button" className="btn" onClick={save} disabled={saved}>{saved ? 'Saved for ground review ✓' : 'Save image + result for ground review'}</button>
              </div>
            )}

            <div className="col gap8" aria-label="Simulated ultrasound trend">
              <div className="row between wrap gap8"><span className="eyebrow">Ultrasound trend (simulated)</span>{t?.status === 'analyzed' && <span className="faint">{signed(t.changePercentFromBaseline)}% since {dayTxt(t.baseline.missionDay)} · slope {signed(t.observedSlopePer30Days)} {unitTxt(t.unit)}/30 days</span>}</div>
              {t?.status === 'insufficient_data' && <span className="faint">Not enough scans for a trend yet.</span>}
              {t?.status === 'analyzed' && (
                <div style={{ height: 160 }} role="img" aria-label={`Simulated spine ultrasound estimates: ${t.points.map((p) => `${dayTxt(p.missionDay)} ${p.value}`).join(', ')}`}>
                  <ResponsiveContainer>
                    <LineChart data={t.points} margin={{ top: 8, right: 22, bottom: 0, left: -6 }}>
                      <CartesianGrid stroke="#1F2A40" vertical={false} />
                      <XAxis dataKey="missionDay" type="number" domain={['dataMin', 'dataMax']} ticks={t.points.map((p) => p.missionDay)} interval={0} stroke="#8F9CB3" tickLine={false} fontSize={11} tickFormatter={(d) => (d < 0 ? `L${d}` : `D${d}`)} />
                      <YAxis stroke="#8F9CB3" tickLine={false} fontSize={11} width={52} domain={['auto', 'auto']} padding={{ top: 10, bottom: 10 }} />
                      <Tooltip contentStyle={{ background: '#0E1626', border: '1px solid #2C3A57', borderRadius: 10 }} labelFormatter={dayTxt}
                        formatter={(v, _n, item) => [`${v} ${unitTxt(t.unit)}`, item?.payload?.source === 'simulated_ai_concept' ? 'Simulated AI estimate (this demo)' : 'Simulated seed value']} />
                      <Line dataKey="value" stroke="#F5C451" strokeWidth={3} strokeDasharray="6 4" dot={{ r: 4, fill: '#F5C451' }} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
      </div>
    </section>
  );
}
