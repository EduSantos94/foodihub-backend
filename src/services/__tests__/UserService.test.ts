import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from '../UserService.js';

vi.mock('../../database/connection.js', () => ({ createDataSource: vi.fn() }));

describe('UserService', () => {
  let service: UserService;
  let repo: any;

  const valid = { email: 'a@b.co', password: 'longenough', first_name: 'A', last_name: 'B' };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UserService();
    repo = {
      findOne: vi.fn(),
      create: vi.fn((x: any) => x),
      save: vi.fn(async (x: any) => ({ ...x, id: 'u1', created_at: new Date(), updated_at: new Date() })),
      findAndCount: vi.fn(),
    };
    (service as any).userRepository = repo;
  });

  describe('createUser validation', () => {
    it('should reject short passwords, bad emails and unknown roles', async () => {
      await expect(service.createUser('s', { ...valid, password: '1234567' })).rejects.toThrow('at least 8');
      await expect(service.createUser('s', { ...valid, email: 'nope' })).rejects.toThrow('valid email');
      await expect(service.createUser('s', { ...valid, role: 'superuser' })).rejects.toThrow('role must be one of');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('should create a staff user by default, hash the password and never set the platform flag', async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await service.createUser('store-1', valid);
      const created = repo.create.mock.calls[0][0];
      expect(created).toMatchObject({ store_id: 'store-1', role: 'staff', active: true });
      expect(created.password_hash).not.toBe('longenough');
      expect(created).not.toHaveProperty('is_platform_admin');
      expect(result.is_platform_admin).toBe(false);
    });

    it('should reject a duplicated email', async () => {
      repo.findOne.mockResolvedValue({ id: 'x' });
      await expect(service.createUser('s', valid)).rejects.toThrow('already exists');
    });
  });

  describe('scoping by store', () => {
    it('getUserById, updateUser and deactivateUser query with the store id', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.getUserById('u', 'store-1')).rejects.toThrow('User not found');
      await expect(service.updateUser('u', 'store-1', {})).rejects.toThrow('User not found');
      await expect(service.deactivateUser('u', 'store-1')).rejects.toThrow('User not found');
      for (const call of repo.findOne.mock.calls) {
        expect(call[0].where).toEqual({ id: 'u', store_id: 'store-1' });
      }
    });
  });

  it('changePassword requires a strong new password', async () => {
    await expect(service.changePassword('u', { current_password: 'x', new_password: 'short' })).rejects.toThrow('at least 8');
  });
});
