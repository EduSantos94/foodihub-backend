import { describe, it, expect, vi } from 'vitest';
import { authorizeRole } from '../auth.js';

const run = (role: string | undefined, ...allowed: string[]) => {
  const req: any = { user: role ? { role } : undefined };
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  authorizeRole(...allowed)(req, res, next);
  return { res, next };
};

describe('authorizeRole', () => {
  it('should let allowed roles through', () => {
    const { next, res } = run('manager', 'admin', 'manager');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should answer 403 for roles that are not allowed (e.g. staff)', () => {
    const { next, res } = run('staff', 'admin', 'manager');
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should answer 401 without a user', () => {
    const { next, res } = run(undefined, 'admin');
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
