import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  AiqfomeClient,
  AiqfomeApiError,
  AiqfomeAuthError,
  AiqfomeNetworkError,
  parseRetryAfterMs,
} from '../AiqfomeClient.js';

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });

const make = (fetchImpl: any, extra: Record<string, unknown> = {}) => {
  const sleep = vi.fn().mockResolvedValue(undefined);
  const client = new AiqfomeClient({
    baseUrl: 'https://api.example.com/',
    getToken: async () => 'TOKEN-123',
    fetchImpl,
    sleep,
    ...extra,
  });
  return { client, sleep };
};

afterEach(() => vi.unstubAllEnvs());

describe('AiqfomeClient construction', () => {
  it('rejects invalid urls and plain http in production', () => {
    const base = { getToken: async () => 't' };
    expect(() => new AiqfomeClient({ ...base, baseUrl: 'nope' })).toThrow('valid URL');
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => new AiqfomeClient({ ...base, baseUrl: 'http://api.example.com' })).toThrow('https');
    expect(() => new AiqfomeClient({ ...base, baseUrl: 'https://api.example.com' })).not.toThrow();
  });

  it('rejects paths without a leading slash', async () => {
    const { client } = make(vi.fn());
    await expect(client.get('store')).rejects.toThrow('start with /');
  });
});

describe('AiqfomeClient requests', () => {
  it('sends the bearer token, joins the base url and builds the query', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ ok: true }));
    const { client } = make(fetchImpl);
    const result = await client.get('/api/v2/orders', { query: { status: 'read', page: 2, skip: undefined } });

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.example.com/api/v2/orders?status=read&page=2');
    expect(init.headers.Authorization).toBe('Bearer TOKEN-123');
    expect(init.redirect).toBe('manual');
  });

  it('serializes the body as JSON and returns undefined on 204', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const { client } = make(fetchImpl);
    expect(await client.put('/x', { body: { a: 1 } })).toBeUndefined();
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.body).toBe('{"a":1}');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('retries a GET on 5xx and succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('boom', { status: 502 }))
      .mockResolvedValueOnce(json({ ok: 1 }));
    const { client, sleep } = make(fetchImpl);
    expect(await client.get('/x')).toEqual({ ok: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxRetries and throws a retryable error', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => new Response('down', { status: 503 }));
    const { client } = make(fetchImpl, { maxRetries: 2 });
    const error = await client.get('/x').catch((e) => e);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(error).toBeInstanceOf(AiqfomeApiError);
    expect(error.status).toBe(503);
    expect(error.retryable).toBe(true);
  });

  it('does NOT retry a POST on 5xx (it may have been processed), but retries it on 429', async () => {
    const f5xx = vi.fn().mockResolvedValue(new Response('x', { status: 500 }));
    await expect(make(f5xx).client.post('/x', { body: {} })).rejects.toBeInstanceOf(AiqfomeApiError);
    expect(f5xx).toHaveBeenCalledTimes(1);

    const f429 = vi.fn().mockResolvedValueOnce(new Response('slow', { status: 429 })).mockResolvedValueOnce(json({ ok: 1 }));
    expect(await make(f429).client.post('/x', { body: {} })).toEqual({ ok: 1 });
    expect(f429).toHaveBeenCalledTimes(2);
  });

  it('honors Retry-After (capped by maxRetryAfterMs)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': '2' } }))
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': '9999' } }))
      .mockResolvedValueOnce(json({ ok: 1 }));
    const { client, sleep } = make(fetchImpl, { maxRetryAfterMs: 5000 });
    await client.get('/x');
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([2000, 5000]);
  });

  it('retries network errors on idempotent methods and wraps the final one', async () => {
    const ok = vi.fn().mockRejectedValueOnce(new Error('ECONNRESET')).mockResolvedValueOnce(json({ ok: 1 }));
    expect(await make(ok).client.get('/x')).toEqual({ ok: 1 });

    const bad = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    const error = await make(bad, { maxRetries: 1 }).client.get('/x').catch((e) => e);
    expect(bad).toHaveBeenCalledTimes(2);
    expect(error).toBeInstanceOf(AiqfomeNetworkError);

    const post = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    await expect(make(post).client.post('/x', { body: {} })).rejects.toBeInstanceOf(AiqfomeNetworkError);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('does not retry other 4xx and exposes status and a truncated body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('x'.repeat(2000), { status: 422 }));
    const error = await make(fetchImpl).client.get('/x').catch((e) => e);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(error.status).toBe(422);
    expect(error.retryable).toBe(false);
    expect(error.body.length).toBe(500);
  });
});

describe('AiqfomeClient authentication', () => {
  it('refreshes the token once on 401 and retries with the new one', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response('', { status: 401 })).mockResolvedValueOnce(json({ ok: 1 }));
    const refreshToken = vi.fn().mockResolvedValue('NEW-TOKEN');
    const { client } = make(fetchImpl, { refreshToken });

    expect(await client.get('/x')).toEqual({ ok: 1 });
    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe('Bearer NEW-TOKEN');
  });

  it('throws AiqfomeAuthError when 401 persists after a refresh, or when there is no refresh', async () => {
    const f1 = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
    const refreshToken = vi.fn().mockResolvedValue('NEW');
    await expect(make(f1, { refreshToken }).client.get('/x')).rejects.toBeInstanceOf(AiqfomeAuthError);
    expect(f1).toHaveBeenCalledTimes(2);

    const f2 = vi.fn().mockResolvedValue(new Response('', { status: 403 }));
    const error = await make(f2).client.get('/x').catch((e) => e);
    expect(error).toBeInstanceOf(AiqfomeAuthError);
    expect(error.retryable).toBe(false);
    expect(f2).toHaveBeenCalledTimes(1);
  });

  it('never leaks the token in errors', async () => {
    const echo = vi.fn().mockResolvedValue(new Response('invalid token TOKEN-123 for user', { status: 400 }));
    const error = await make(echo).client.get('/x').catch((e) => e);
    expect(error.body).toContain('[redacted]');
    expect(`${error.message} ${error.body}`).not.toContain('TOKEN-123');

    const net = vi.fn().mockRejectedValue(new Error('socket hang up for TOKEN-123'));
    const netError = await make(net, { maxRetries: 0 }).client.get('/x').catch((e) => e);
    expect(netError.message).not.toContain('TOKEN-123');
  });
});

describe('parseRetryAfterMs', () => {
  it('reads seconds and http dates, and ignores junk', () => {
    expect(parseRetryAfterMs('3')).toBe(3000);
    expect(parseRetryAfterMs(new Date(10_000).toUTCString(), 4_000)).toBe(6000);
    expect(parseRetryAfterMs('soon')).toBeUndefined();
    expect(parseRetryAfterMs(null)).toBeUndefined();
  });
});
