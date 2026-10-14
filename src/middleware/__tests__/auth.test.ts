import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authorizeRole, requireOwnStore, requirePlatformAdmin, authenticateToken, invalidateAuthCache } from '../auth.js';
import { AuthService } from '../../services/AuthService.js';
import { createDataSource } from '../../database/connection.js';

vi.mock('../../database/connection.js', () => ({ createDataSource: vi.fn() }));

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

describe('requireOwnStore', () => {
  const run = (user: any, id: string) => {
    const req: any = { user, params: { id } };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();
    requireOwnStore(req, res, next);
    return { res, next };
  };

  it('should let a user reach their own store', () => {
    const { next, res } = run({ store_id: 'store-1' }, 'store-1');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should answer 404 (not 403) for another tenant store', () => {
    const { next, res } = run({ store_id: 'store-1' }, 'store-2');
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should answer 401 without a user', () => {
    const { next, res } = run(undefined, 'store-1');
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('requirePlatformAdmin', () => {
  const findOne = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    (createDataSource as any).mockResolvedValue({ getRepository: () => ({ findOne }) });
  });

  const run = async (user: any) => {
    const req: any = { user };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();
    await requirePlatformAdmin(req, res, next);
    return { res, next };
  };

  it('should let an active platform admin through', async () => {
    findOne.mockResolvedValue({ id: 'u1', is_platform_admin: true });
    const { next, res } = await run({ id: 'u1', role: 'staff' });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should refuse a store admin that is not a platform admin, whatever the token says', async () => {
    findOne.mockResolvedValue({ id: 'u1', is_platform_admin: false });
    const { next, res } = await run({ id: 'u1', role: 'admin', is_platform_admin: true });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should refuse when the user is missing or inactive in the database', async () => {
    findOne.mockResolvedValue(null);
    const { next, res } = await run({ id: 'gone' });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should answer 401 without a user and 500 when the lookup fails', async () => {
    expect((await run(undefined)).res.status).toHaveBeenCalledWith(401);
    findOne.mockRejectedValue(new Error('db down'));
    expect((await run({ id: 'u1' })).res.status).toHaveBeenCalledWith(500);
  });
});

describe('authenticateToken (account must still be active)', () => {
  const query = vi.fn();
  const sign = (payload: any) => (new AuthService() as any).generateToken(payload);

  beforeEach(() => {
    vi.clearAllMocks();
    invalidateAuthCache();
    (createDataSource as any).mockResolvedValue({ query });
  });

  const run = async (header?: string) => {
    const req: any = { headers: header ? { authorization: header } : {} };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();
    await authenticateToken(req, res, next);
    return { req, res, next };
  };

  const active = { user_active: true, store_active: true, store_deleted: null };

  it('should accept a valid token of an active account and expose the user', async () => {
    query.mockResolvedValue([active]);
    const { req, next } = await run('Bearer ' + sign({ id: 'u1', store_id: 's1', role: 'admin' }));
    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({ id: 'u1', store_id: 's1' });
  });

  it('should reject missing or malformed credentials with 401', async () => {
    expect((await run()).res.status).toHaveBeenCalledWith(401);
    expect((await run('Token abc')).res.status).toHaveBeenCalledWith(401);
    expect((await run('Bearer not.a.jwt')).res.status).toHaveBeenCalledWith(401);
  });

  it('should reject a valid token whose user was deactivated, whose store is gone, or who no longer exists', async () => {
    const header = 'Bearer ' + sign({ id: 'u1', store_id: 's1', role: 'admin' });
    for (const row of [[{ ...active, user_active: false }], [{ ...active, store_active: false }], [{ ...active, store_deleted: new Date() }], []]) {
      invalidateAuthCache();
      query.mockResolvedValue(row);
      const { res, next } = await run(header);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    }
  });

  it('should cache the answer briefly and forget it on invalidateAuthCache', async () => {
    query.mockResolvedValue([active]);
    const header = 'Bearer ' + sign({ id: 'u9', store_id: 's1', role: 'staff' });
    await run(header);
    await run(header);
    expect(query).toHaveBeenCalledTimes(1);

    invalidateAuthCache('u9');
    query.mockResolvedValue([{ ...active, user_active: false }]);
    const { res } = await run(header);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should fail closed (503) when the database cannot be reached', async () => {
    query.mockRejectedValue(new Error('db down'));
    const { res, next } = await run('Bearer ' + sign({ id: 'u1' }));
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
