// Run: npm test   (API service: success, 404, offline, bad JSON, missing sections)
import { describe, it, expect, vi, afterEach } from 'vitest';
import { boneHealthSource, ApiError } from './boneHealthApi.js';

const reply = (status, body) => Promise.resolve({ status, ok: status >= 200 && status < 300, json: () => (body === undefined ? Promise.reject(new Error('no json')) : Promise.resolve(body)) });
afterEach(() => vi.unstubAllGlobals());

describe('boneHealthSource', () => {
  it('returns the backend sections unchanged', async () => {
    const body = { astronautId: 'AST-001', boneMarkers: { metrics: {} }, biomarkerTrends: { metrics: {} }, context: {}, assessment: { observations: [] } };
    vi.stubGlobal('fetch', vi.fn(() => reply(200, body)));
    const { data, from } = await boneHealthSource.getBoneHealth('AST-001');
    expect(from).toBe('backend');
    expect(data.boneMarkers).toEqual(body.boneMarkers);
    expect(data.missingSections).toEqual([]);
    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/astronauts\/AST-001\/bone-health$/);
  });
  it('404 → not_found', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply(404, { error: 'Astronaut not found' })));
    await expect(boneHealthSource.getBoneHealth('X')).rejects.toMatchObject({ kind: 'not_found' });
  });
  it('network failure → offline', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(boneHealthSource.getBoneHealth('AST-001')).rejects.toBeInstanceOf(ApiError);
    await expect(boneHealthSource.getBoneHealth('AST-001')).rejects.toMatchObject({ kind: 'offline' });
  });
  it('non-JSON or empty object → bad_response', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply(200, undefined)));
    await expect(boneHealthSource.getBoneHealth('AST-001')).rejects.toMatchObject({ kind: 'bad_response' });
    vi.stubGlobal('fetch', vi.fn(() => reply(200, {})));
    await expect(boneHealthSource.getBoneHealth('AST-001')).rejects.toMatchObject({ kind: 'bad_response' });
  });
  it('reports a missing section instead of guessing it', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply(200, { boneMarkers: { metrics: {} }, assessment: {} })));
    const { data } = await boneHealthSource.getBoneHealth('AST-001');
    expect(data.missingSections).toEqual(['biomarkerTrends', 'context']);
  });
});
