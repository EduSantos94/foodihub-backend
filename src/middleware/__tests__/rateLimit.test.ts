import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rateLimit } from '../rateLimit.js';

describe('rateLimit', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const call = (mw: any, ip = '1.1.1.1') => {
    const req: any = { ip };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), setHeader: vi.fn() };
    const next = vi.fn();
    mw(req, res, next);
    return { res, next };
  };

  it('should allow up to max and then answer 429 with Retry-After', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 3, key: (r) => r.ip! });
    for (let i = 0; i < 3; i++) expect(call(mw).next).toHaveBeenCalled();
    const blocked = call(mw);
    expect(blocked.next).not.toHaveBeenCalled();
    expect(blocked.res.status).toHaveBeenCalledWith(429);
    expect(blocked.res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('should count each key separately', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 1, key: (r) => r.ip! });
    expect(call(mw, 'a').next).toHaveBeenCalled();
    expect(call(mw, 'b').next).toHaveBeenCalled();
    expect(call(mw, 'a').next).not.toHaveBeenCalled();
  });

  it('should open again after the window', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 1, key: (r) => r.ip! });
    call(mw);
    expect(call(mw).next).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_001);
    expect(call(mw).next).toHaveBeenCalled();
  });
});
