// Small shared UI pieces: icons, status chips, page header.
import { Link } from 'react-router-dom';

const paths = {
  heart: <><path d="M12 20.5s-7.5-4.6-9.4-9.4A5.2 5.2 0 0 1 12 6.3a5.2 5.2 0 0 1 9.4 4.8c-1.9 4.8-9.4 9.4-9.4 9.4z" /><path d="M6.5 12h3l1.5-2.5 2 4.5 1.5-2h3" /></>,
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  checkin: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 3h6v3H9zM9 13l2 2 4-4" /></>,
  forecast: <><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 3-3" /><path d="M17 10l3-3" strokeDasharray="2 2" /></>,
  body: <><circle cx="12" cy="5" r="2.5" /><path d="M12 8v7M7 10l5-1 5 1M9.5 21l2.5-6 2.5 6" /></>,
  spine: <><rect x="9" y="2.5" width="6" height="3.5" rx="1.2" /><rect x="8.5" y="7.5" width="7" height="3.5" rx="1.2" /><rect x="8" y="12.5" width="8" height="3.5" rx="1.2" /><rect x="7.5" y="17.5" width="9" height="4" rx="1.2" /></>,
  send: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />,
  trends: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  next: <path d="M5 12h14M13 6l6 6-6 6" />,
  check: <path d="M5 12l4 4 10-10" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  refresh: <><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></>,
  book: <><path d="M4 5h11a3 3 0 0 1 3 3v12H7a3 3 0 0 1-3-3z" /><path d="M8 9h6M8 13h6" /></>,
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />,
  wifiOff: <path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-2.3-1.7M12 20h.01" />,
  upload: <path d="M12 20V8M6 13l6-6 6 6M5 4h14" />,
  download: <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  shield: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
};

export function Icon({ name, size = 20, stroke = 2, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>{paths[name]}</svg>
  );
}

export const STATUS = {
  normal: { label: 'Normal', cls: 'chip-normal', shape: <><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></> },
  watch: { label: 'Watch', cls: 'chip-watch', shape: <><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17h.01" /></> },
  act: { label: 'Act now', cls: 'chip-act', shape: <><path d="M12 2l10 10-10 10L2 12z" /><path d="M12 8v5M12 16h.01" /></> },
};

export function StatusChip({ status, label, big }) {
  const s = STATUS[status] || STATUS.normal;
  return (
    <span className={`chip ${s.cls} ${big ? 'chip-big' : ''}`}>
      <svg width={big ? 15 : 14} height={big ? 15 : 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{s.shape}</svg>
      {label || s.label}
    </span>
  );
}

export function PageHeader({ title, subtitle, back = '/', right }) {
  return (
    <header className="page-header">
      <div className="row gap16">
        {back && <Link to={back} className="icon-btn" aria-label="Back"><Icon name="back" /></Link>}
        <div className="col gap4">
          <h1 className="h1">{title}</h1>
          {subtitle && <span className="muted">{subtitle}</span>}
        </div>
      </div>
      {right}
    </header>
  );
}
