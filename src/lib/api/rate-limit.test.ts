import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const limitMock = vi.fn();
const ctorArgs: unknown[] = [];

vi.mock('@upstash/ratelimit', () => {
  class Ratelimit {
    static slidingWindow = vi.fn((n: number, w: string) => ({ n, w }));
    constructor(opts: unknown) {
      ctorArgs.push(opts);
    }
    limit = limitMock;
  }
  return { Ratelimit };
});
vi.mock('@upstash/redis', () => ({
  Redis: { fromEnv: vi.fn(() => ({ fake: 'redis' })) },
}));

import type { clientIp as ClientIp, rateLimit as RateLimit } from './rate-limit';

let clientIp: typeof ClientIp;
let rateLimit: typeof RateLimit;

const req = (headers: Record<string, string> = {}) =>
  new Request('http://x.test/', { headers });

beforeEach(async () => {
  vi.resetModules(); // limiter cache is module-level; start clean per test
  ({ clientIp, rateLimit } = await import('./rate-limit'));
  limitMock.mockReset();
  ctorArgs.length = 0;
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('clientIp', () => {
  it('uses the first x-forwarded-for entry', () => {
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4');
  });
  it('falls back to x-real-ip', () => {
    expect(clientIp(req({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
  });
  it('returns unknown with no headers', () => {
    expect(clientIp(req())).toBe('unknown');
  });
});

describe('rateLimit', () => {
  it('returns null on success', async () => {
    limitMock.mockResolvedValue({ success: true, reset: Date.now() + 1000 });
    expect(await rateLimit(req({ 'x-forwarded-for': '1.2.3.4' }))).toBeNull();
    expect(limitMock).toHaveBeenCalledWith('1.2.3.4');
  });

  it('returns 429 RATE_LIMITED with Retry-After in whole seconds when exceeded', async () => {
    limitMock.mockResolvedValue({ success: false, reset: Date.now() + 30_500 });
    const res = await rateLimit(req());
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    expect((await res!.json()).error.code).toBe('RATE_LIMITED');
    const retry = Number(res!.headers.get('Retry-After'));
    expect(Number.isInteger(retry)).toBe(true);
    expect(retry).toBeGreaterThanOrEqual(30);
    expect(retry).toBeLessThanOrEqual(31);
  });

  it('Retry-After is at least 1 when reset is already past', async () => {
    limitMock.mockResolvedValue({ success: false, reset: Date.now() - 5000 });
    const res = await rateLimit(req());
    expect(res!.headers.get('Retry-After')).toBe('1');
  });

  it('defaults to 60 per 1 m and honours overrides', async () => {
    limitMock.mockResolvedValue({ success: true, reset: 0 });
    const { Ratelimit } = await import('@upstash/ratelimit');
    await rateLimit(req());
    expect(Ratelimit.slidingWindow).toHaveBeenLastCalledWith(60, '1 m');
    await rateLimit(req(), { limit: 5, window: '10 s', prefix: 'search' });
    expect(Ratelimit.slidingWindow).toHaveBeenLastCalledWith(5, '10 s');
  });

  it('fails open (null) with a warning when Upstash env is missing in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await rateLimit(req())).toBeNull();
    expect(warn).toHaveBeenCalled();
    expect(limitMock).not.toHaveBeenCalled();
  });

  it('fails closed (500 INTERNAL) when Upstash env is missing in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await rateLimit(req());
    expect(res!.status).toBe(500);
    expect((await res!.json()).error.code).toBe('INTERNAL');
  });

  it('fails open when the Upstash call itself throws', async () => {
    limitMock.mockRejectedValue(new Error('network'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await rateLimit(req())).toBeNull();
    expect(err).toHaveBeenCalled();
  });
});
