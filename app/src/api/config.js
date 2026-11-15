// API settings, read from Vite environment variables (see app/.env.example).
// VITE_API_BASE_URL     where the AstroPulse backend runs (default http://localhost:3001)
// VITE_ASTRONAUT_MAP    which backend astronaut record belongs to each crew member, "crewId:backendId,…"
// VITE_API_TIMEOUT_MS   give up on a request after this long (default 6000)
const env = import.meta.env ?? {};

export const API_BASE_URL = (env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '');
export const API_TIMEOUT_MS = Number(env.VITE_API_TIMEOUT_MS) || 6000;

// The backend's demo fixtures only have AST-001 so far; map it to Maya.
const RAW_MAP = env.VITE_ASTRONAUT_MAP || 'maya:AST-001';
export const ASTRONAUT_MAP = Object.fromEntries(
  RAW_MAP.split(',').map((pair) => pair.split(':').map((s) => s.trim())).filter(([a, b]) => a && b),
);

export const backendIdFor = (crewId) => ASTRONAUT_MAP[crewId] ?? null;
