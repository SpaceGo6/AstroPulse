// Daily Mode home: check-in prompt, status of every indicator, link to the watchdog.
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useData } from '../data/DataContext.jsx';
import { INDICATORS } from '../engine/indicators.js';
import { allStatuses } from '../engine/engine.js';
import { Icon, StatusChip } from '../components/ui.jsx';

function valueText(ind, s) {
  if (ind.id === 'bone') return <>{s.value} <small>{ind.unit}</small></>;
  if (ind.id === 'radiation') return <>{Math.round(s.value)} <small>{ind.unit}</small></>;
  return <>{ind.format(s.row)} <small>{ind.unit}</small></>;
}

export default function Today() {
  const { crew, rows, today, rules, environment, checkin } = useData();
  const statuses = allStatuses(rows, today, rules, environment, INDICATORS.map((i) => i.id));
  const counts = { normal: 0, watch: 0, act: 0 };
  Object.values(statuses).forEach((s) => { counts[s.status] += 1; });
  const checkedIn = Boolean(checkin.bp);

  // count the "to watch" number up for a little life on load
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const target = counts.watch + counts.act;
    let n = 0;
    const t = setInterval(() => { n += 1; setShown(Math.min(n, target)); if (n >= target) clearInterval(t); }, 300);
    return () => clearInterval(t);
  }, [counts.watch, counts.act]);

  const firstName = crew.name.replace('Cmdr. ', '').split(' ')[0];
  return (
    <>
      <header className="page-header">
        <div className="col gap4">
          <h1 className="h1" style={{ fontSize: 32 }}>Good morning, {firstName}</h1>
          <span className="muted" style={{ fontSize: 15 }}>{crew.name} · {crew.role} · Mission day {today} · Mars transit</span>
        </div>
        <div className="row gap8 wrap">
          <span className="pill"><Icon name="clock" size={16} />Earth delay 18 min</span>
          <Link to="/alert" className="pill pill-live" title="Opens the watchdog demo"><span className="dot" aria-hidden="true" />Watchdog live · offline</Link>
        </div>
      </header>

      <section className="split" style={{ '--cols': '2fr 1fr' }}>
        <div className="panel panel-accent row between gap20 wrap" style={{ animation: 'fadeUp .5s ease both' }}>
          <div className="col gap8">
            <span className="eyebrow">{checkedIn ? 'Done today' : 'Scheduled · 07:30 ship time'}</span>
            <h2 className="h1" style={{ fontSize: 26 }}>{checkedIn ? 'Morning check-in complete' : 'Morning check-in is due'}</h2>
            <span style={{ color: '#B8C4D8', fontSize: 15 }}>6 readings · about 2 minutes · each step shows how to measure</span>
          </div>
          <Link to="/checkin" className="btn btn-primary btn-big" style={{ flex: 'none' }}>
            {checkedIn ? 'Review' : 'Start check-in'}<Icon name="next" />
          </Link>
        </div>
        <div className="panel col gap8" style={{ animation: 'fadeUp .5s ease .1s both' }}>
          <span className="muted" style={{ fontWeight: 600 }}>Today at a glance</span>
          <div className="row gap8" style={{ alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'var(--display)', fontSize: 40, fontWeight: 600, color: 'var(--warn)' }}>{shown}</span>
            <span style={{ fontSize: 16, fontWeight: 600 }}>to watch</span>
          </div>
          <span className="muted">{counts.normal} normal · {counts.act} need action now</span>
        </div>
      </section>

      <section aria-label="Health indicators" className="grid-4">
        {INDICATORS.map((ind, i) => {
          const s = statuses[ind.id];
          const to = ind.id === 'bone' ? '/spine' : ind.id === 'radiation' ? '/forecast' : `/trends/${ind.id}`;
          return (
            <Link key={ind.id} to={to} className={`card is-${s.status}`} style={{ animationDelay: `${0.15 + i * 0.07}s` }}>
              <div className="row between"><span className="muted" style={{ fontWeight: 600 }}>{ind.label}</span><StatusChip status={s.status} /></div>
              <div className="big-num">{valueText(ind, s)}</div>
              <div className="muted" style={{ fontSize: 13, color: s.status === 'normal' ? 'var(--muted)' : 'var(--link)' }}>{s.note}{s.status !== 'normal' ? ' →' : ''}</div>
            </Link>
          );
        })}
      </section>

      <footer className="row between faint wrap" style={{ marginTop: 'auto' }}>
        <span>Simulated crew data · prototype, not a medical device</span>
        <span>Guidance based on NASA Human Research Program &amp; CSA resources · bone evidence: NASA bed-rest DXA (MR035G)</span>
      </footer>
    </>
  );
}
