// App shell: fixed sidebar + page content. The Red Alert screen lives outside
// this layout on purpose (emergency = full-screen, nothing else to tap).
import { NavLink, Outlet, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { HelmetMark, Wordmark } from './Logo.jsx';
import { Icon } from './ui.jsx';
import { onCrewMessage } from '../sync/channel.js';
import { useData } from '../data/DataContext.jsx';

const NAV = [
  { to: '/', label: 'Today', icon: 'home', end: true },
  { to: '/checkin', label: 'Check-in', icon: 'checkin' },
  { to: '/spine', label: 'Spine', icon: 'spine' },
  { to: '/forecast', label: 'Forecast', icon: 'forecast' },
  { to: '/body', label: 'Body', icon: 'body' },
  { to: '/trends/bp', label: 'Trends', icon: 'trends' },
  { to: '/audit', label: 'Audit', icon: 'shield' },
];

export default function Layout() {
  const { crew, crewList, setCrewId } = useData();
  const [remoteAlert, setRemoteAlert] = useState(null);
  // Crew sync demo: a Red Alert raised on another tablet (another browser tab) shows here.
  useEffect(() => onCrewMessage((msg) => { if (msg.type === 'red-alert') setRemoteAlert(msg); }), []);

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Main">
        <Link to="/" className="logo" aria-label="AstroPulse by SpaceGo, go to Today" title="AstroPulse by SpaceGo"><HelmetMark size={46} detail={false} /></Link>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Icon name={n.icon} size={24} />{n.label}
          </NavLink>
        ))}
        <div className="sidebar-foot">
          <label className="sr-only" htmlFor="crew-select">Crew member</label>
          <select id="crew-select" className="crew-select" value={crew.id} onChange={(e) => setCrewId(e.target.value)}>
            {crewList.map((c) => <option key={c.id} value={c.id}>{c.name.replace('Cmdr. ', '').split(' ')[0]}</option>)}
          </select>
        </div>
      </nav>
      <main className="content">
        <Link to="/" className="mobile-brand" aria-label="AstroPulse by SpaceGo, go to Today"><HelmetMark size={32} detail={false} /><Wordmark size={18} by /></Link>
        {remoteAlert && (
          <Link to="/alert" className="remote-alert" role="alert">
            <Icon name="info" /> Red Alert on another crew tablet: {remoteAlert.crewName}. Tap to open triage.
          </Link>
        )}
        <Outlet />
      </main>
    </div>
  );
}
