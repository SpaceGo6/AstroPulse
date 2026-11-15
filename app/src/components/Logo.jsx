// AstroPulse brand: the helmet mark (heartbeat across the visor, orbit ring) and the wordmark.
// Same artwork as the logo canvas ("App A · Helmet visor"), with a few details dropped at small sizes.
import { useId } from 'react';

export function HelmetMark({ size = 44, accent = '#6EE0D3', detail = true, label }) {
  const id = useId().replace(/:/g, '');
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <svg width={size} height={size} viewBox="0 0 600 600" {...a11y}>
      <defs>
        <radialGradient id={`${id}hs`} cx="0.36" cy="0.3" r="0.8"><stop offset="0" stopColor="#FFFFFF" /><stop offset="0.55" stopColor="#DCE4F2" /><stop offset="1" stopColor="#8E9DBA" /></radialGradient>
        <linearGradient id={`${id}vs`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#22396B" /><stop offset="1" stopColor="#070D1E" /></linearGradient>
        <linearGradient id={`${id}pl`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={accent} /><stop offset="1" stopColor="#5B9CFF" /></linearGradient>
        <clipPath id={`${id}vc`}><ellipse cx="300" cy="290" rx="131" ry="114" /></clipPath>
      </defs>
      <g transform="translate(300 300) rotate(-18)"><path d="M -272 0 A 272 82 0 0 1 272 0" fill="none" stroke="#F5C451" strokeWidth="9" strokeLinecap="round" opacity="0.85" /></g>
      <circle cx="127" cy="296" r="27" fill="#B6C3D8" stroke="#7F8FAD" strokeWidth="5" />
      <circle cx="473" cy="296" r="27" fill="#B6C3D8" stroke="#7F8FAD" strokeWidth="5" />
      <circle cx="300" cy="288" r="176" fill={`url(#${id}hs)`} />
      <path d="M 186 438 Q 300 478 414 438 L 420 486 Q 300 526 180 486 Z" fill="#AEBBD1" />
      <ellipse cx="300" cy="290" rx="137" ry="120" fill={`url(#${id}vs)`} stroke="#2A3F6E" strokeWidth="9" />
      <g clipPath={`url(#${id}vc)`}>
        {detail && <>
          <circle cx="214" cy="236" r="3" fill="#FFFFFF" opacity="0.8" /><circle cx="392" cy="350" r="3" fill="#FFFFFF" opacity="0.7" />
          <circle cx="372" cy="232" r="15" fill="#F5C451" />
        </>}
        <path d="M 150 302 H 226 L 246 260 L 268 344 L 294 212 L 320 334 L 338 302 H 452" fill="none" stroke={`url(#${id}pl)`} strokeWidth={detail ? 13 : 20} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {detail && <path d="M 204 226 Q 236 190 288 184" fill="none" stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round" opacity="0.45" />}
      <g transform="translate(300 300) rotate(-18)"><path d="M -272 0 A 272 82 0 0 0 272 0" fill="none" stroke="#F5C451" strokeWidth="9" strokeLinecap="round" /><circle cx="208" cy="53" r="14" fill="#F5C451" /></g>
    </svg>
  );
}

export function Wordmark({ size = 20, by = false }) {
  return (
    <span className="wordmark" style={{ fontSize: size }}>
      Astro<span style={{ color: 'var(--accent)' }}>Pulse</span>
      {by && <small className="wordmark-by">by SpaceGo</small>}
    </span>
  );
}
