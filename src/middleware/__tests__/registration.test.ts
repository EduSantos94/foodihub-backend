import { describe, it, expect, vi, afterEach } from 'vitest';
import { registrationOpen, requireRegistrationOpen } from '../registration.js';

const run = () => {
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  requireRegistrationOpen({} as any, res, next);
  return { res, next };
};

describe('registration switch', () => {
  afterEach(() => {
    delete process.env.ALLOW_PUBLIC_REGISTRATION;
  });

  it('is open when the variable is not set', () => {
    expect(registrationOpen()).toBe(true);
    const { next, res } = run();
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each(['false', 'FALSE', ' False '])('is closed with ALLOW_PUBLIC_REGISTRATION=%j', (value) => {
    process.env.ALLOW_PUBLIC_REGISTRATION = value;
    expect(registrationOpen()).toBe(false);
    const { next, res } = run();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Registration is closed' }));
  });

  it('stays open for any other value', () => {
    process.env.ALLOW_PUBLIC_REGISTRATION = 'true';
    expect(registrationOpen()).toBe(true);
  });
});
