import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserController } from '../UserController.js';

vi.mock('../../services/UserService.js');
vi.mock('../../middleware/auth.js', () => ({ invalidateAuthCache: vi.fn() }));

describe('UserController (tenant isolation and roles)', () => {
  let controller: UserController;
  let svc: any;
  let res: any;

  const as = (role: string, id = 'me', extra: any = {}) => ({ user: { id, store_id: 'store-1', role }, body: {}, params: {}, query: {}, ...extra });

  beforeEach(() => {
    vi.clearAllMocks();
    svc = { createUser: vi.fn(), getUserById: vi.fn(), updateUser: vi.fn(), changePassword: vi.fn(), getUsersByStore: vi.fn(), deactivateUser: vi.fn() };
    controller = new UserController();
    (controller as any).userService = svc;
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  });

  describe('createUser', () => {
    it('should create in the token store and ignore store_id/is_platform_admin from the body', async () => {
      svc.createUser.mockResolvedValue({ id: 'u2' });
      await controller.createUser(as('admin', 'me', { body: { email: 'a@b.co', password: 'x', first_name: 'A', last_name: 'B', role: 'manager', store_id: 'other', is_platform_admin: true } }) as any, res);

      expect(svc.createUser).toHaveBeenCalledWith('store-1', { email: 'a@b.co', password: 'x', first_name: 'A', last_name: 'B', phone: undefined, role: 'manager' });
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('getUser', () => {
    it('should look up inside the own store only', async () => {
      svc.getUserById.mockResolvedValue({ id: 'u2' });
      await controller.getUser(as('manager', 'me', { params: { id: 'u2' } }) as any, res);
      expect(svc.getUserById).toHaveBeenCalledWith('u2', 'store-1');
    });

    it('should hide other users from staff but let them read themselves', async () => {
      await controller.getUser(as('staff', 'me', { params: { id: 'someone-else' } }) as any, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(svc.getUserById).not.toHaveBeenCalled();

      svc.getUserById.mockResolvedValue({ id: 'me' });
      await controller.getUser(as('staff', 'me', { params: { id: 'me' } }) as any, res);
      expect(svc.getUserById).toHaveBeenCalledWith('me', 'store-1');
    });

    it('should answer 404 when the user belongs to another store', async () => {
      svc.getUserById.mockRejectedValue(new Error('User not found'));
      await controller.getUser(as('admin', 'me', { params: { id: 'foreign' } }) as any, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateUser', () => {
    it('should let a user edit only their own profile, with whitelisted fields', async () => {
      svc.updateUser.mockResolvedValue({ id: 'me' });
      await controller.updateUser(as('staff', 'me', { params: { id: 'me' }, body: { first_name: 'Z', role: 'admin', store_id: 'x', email: 'y@z.co', is_platform_admin: true } }) as any, res);

      expect(svc.updateUser).toHaveBeenCalledWith('me', 'store-1', { first_name: 'Z', last_name: undefined, phone: undefined });
    });

    it('should not let staff/managers edit someone else', async () => {
      await controller.updateUser(as('manager', 'me', { params: { id: 'u2' }, body: { first_name: 'Z' } }) as any, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(svc.updateUser).not.toHaveBeenCalled();
    });

    it('should let an admin edit and deactivate others through active, but never themselves', async () => {
      svc.updateUser.mockResolvedValue({ id: 'u2' });
      await controller.updateUser(as('admin', 'me', { params: { id: 'u2' }, body: { active: false } }) as any, res);
      expect(svc.updateUser).toHaveBeenCalledWith('u2', 'store-1', expect.objectContaining({ active: false }));

      svc.updateUser.mockClear();
      await controller.updateUser(as('admin', 'me', { params: { id: 'me' }, body: { active: false } }) as any, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(svc.updateUser).not.toHaveBeenCalled();
    });

    it('should not let a non-admin toggle active even on themselves', async () => {
      await controller.updateUser(as('manager', 'me', { params: { id: 'me' }, body: { active: true } }) as any, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('changePassword', () => {
    it('should only change the own password', async () => {
      await controller.changePassword(as('admin', 'me', { params: { id: 'u2' }, body: { current_password: 'a', new_password: 'b' } }) as any, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(svc.changePassword).not.toHaveBeenCalled();

      await controller.changePassword(as('staff', 'me', { params: { id: 'me' }, body: { current_password: 'a', new_password: 'bbbbbbbb' } }) as any, res);
      expect(svc.changePassword).toHaveBeenCalledWith('me', { current_password: 'a', new_password: 'bbbbbbbb' });
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate inside the own store and refuse self-deactivation', async () => {
      svc.deactivateUser.mockResolvedValue({ id: 'u2' });
      await controller.deactivateUser(as('admin', 'me', { params: { id: 'u2' } }) as any, res);
      expect(svc.deactivateUser).toHaveBeenCalledWith('u2', 'store-1');

      svc.deactivateUser.mockClear();
      await controller.deactivateUser(as('admin', 'me', { params: { id: 'me' } }) as any, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(svc.deactivateUser).not.toHaveBeenCalled();
    });
  });

  it('getUsersByStore lists only the token store', async () => {
    svc.getUsersByStore.mockResolvedValue({ data: [], pagination: {} });
    await controller.getUsersByStore(as('admin', 'me', { query: { page: '2' } }) as any, res);
    expect(svc.getUsersByStore).toHaveBeenCalledWith('store-1', expect.objectContaining({ page: 2 }));
  });
});
