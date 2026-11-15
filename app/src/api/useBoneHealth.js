// React hook: bone-health data for one crew member, with loading / error / empty states.
import { useCallback, useEffect, useState } from 'react';
import { boneHealthSource } from './boneHealthApi.js';
import { backendIdFor } from './config.js';

export function useBoneHealth(crewId) {
  const astronautId = backendIdFor(crewId);
  const [state, setState] = useState({ status: astronautId ? 'loading' : 'unmapped', data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!astronautId) { setState({ status: 'unmapped', data: null, error: null }); return undefined; }
    const ctrl = new AbortController();
    setState((s) => ({ status: 'loading', data: s.data && s.data.astronautId === astronautId ? s.data : null, error: null }));
    boneHealthSource.getBoneHealth(astronautId, { signal: ctrl.signal })
      .then((res) => setState({ status: 'ready', data: res.data, fetchedAt: res.fetchedAt, error: null }))
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setState({ status: err.kind === 'not_found' ? 'not_found' : 'error', data: null, error: err });
      });
    return () => ctrl.abort();
  }, [astronautId, attempt]);

  return { ...state, astronautId, retry };
}
