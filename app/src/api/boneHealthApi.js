// Bone-health data from the AstroPulse backend.
// Offline-first plan: every read goes through `boneHealthSource`, which today only asks the
// backend. Later a local store (IndexedDB) and local analysis can be added behind the same
// function: read local → try remote → save remote result locally, without touching the UI.
import { API_BASE_URL, API_TIMEOUT_MS } from './config.js';

export class ApiError extends Error {
  constructor(kind, message, status = null) {
    super(message);
    this.kind = kind;     // 'offline' | 'timeout' | 'not_found' | 'http' | 'bad_response'
    this.status = status;
  }
}

async function getJson(path, opts = {}) { return requestJson('GET', path, undefined, opts); }

async function requestJson(method, path, payload, { signal } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('timeout', 'TimeoutError')), API_TIMEOUT_MS);
  const onAbort = () => ctrl.abort(signal.reason);
  signal?.addEventListener('abort', onAbort);
  try {
    let res;
    try {
      res = await fetch(`${API_BASE_URL}${path}`, {
        method, signal: ctrl.signal,
        headers: payload === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
    } catch (err) {
      if (signal?.aborted) throw err; // the caller cancelled: not an error to show
      if (ctrl.signal.reason?.name === 'TimeoutError') throw new ApiError('timeout', `The backend did not answer within ${API_TIMEOUT_MS / 1000} s.`);
      throw new ApiError('offline', `Can't reach the backend at ${API_BASE_URL}.`);
    }
    let body = null;
    try { body = await res.json(); } catch { /* handled below */ }
    if (res.status === 404) throw new ApiError('not_found', body?.error || 'No record for this astronaut.', 404);
    if (!res.ok) throw new ApiError('http', body?.error || `The backend answered ${res.status}.`, res.status);
    if (body == null) throw new ApiError('bad_response', 'The backend sent something that is not JSON.');
    return body;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

// Check the response has the four sections the dashboard reads; anything missing is reported,
// not guessed. Values are passed through unchanged: all calculations stay in the backend.
function checkBoneHealth(body) {
  const sections = ['boneMarkers', 'biomarkerTrends', 'context', 'assessment'];
  const missing = sections.filter((k) => body?.[k] == null || typeof body[k] !== 'object');
  if (missing.length === sections.length) throw new ApiError('bad_response', 'The response has none of the expected bone-health sections.');
  return { ...body, missingSections: missing };
}

const remote = {
  boneHealth: (astronautId, opts) => getJson(`/api/astronauts/${encodeURIComponent(astronautId)}/bone-health`, opts).then(checkBoneHealth),
  health: (opts) => getJson('/api/health', opts),
};

// The one place the UI reads bone-health data from. Returns { data, from: 'backend' }.
export const boneHealthSource = {
  async getBoneHealth(astronautId, opts) {
    const data = await remote.boneHealth(astronautId, opts);
    return { data, from: 'backend', fetchedAt: new Date().toISOString() };
  },
};

