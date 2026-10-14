import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { AuthService } from '../AuthService.js';

vi.mock('../../database/connection.js', () => ({ createDataSource: vi.fn() }));

const VALID_CNPJ = '11.222.333/0001-81';

describe('AuthService', () => {
  let service: AuthService;
  let users: any;
  let stores: any;

  const register = (over: any = {}) =>
    service.register({
      store_name: 'Loja',
      store_email: 'loja@x.co',
      store_document: VALID_CNPJ,
      admin_email: 'dono@x.co',
      admin_password: 'longenough',
      admin_first_name: 'Dono',
      admin_last_name: 'Da Loja',
      ...over,
    });

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService();
    users = {
      getUserByEmail: vi.fn().mockResolvedValue(null),
      createUser: vi.fn().mockResolvedValue({ id: 'u1', email: 'dono@x.co', role: 'admin', is_platform_admin: false }),
      verifyPassword: vi.fn((p: string, h: string) => bcrypt.compare(p, h)),
    };
    stores = {
      createStore: vi.fn().mockResolvedValue({ id: 'store-1' }),
      hardDeleteStore: vi.fn(),
    };
    (service as any).userService = users;
    (service as any).storeService = stores;
  });

  describe('register (store signup by CNPJ)', () => {
    it('should store the CNPJ as digits only and create a plain store admin', async () => {
      const result = await register();
      expect(stores.createStore).toHaveBeenCalledWith(expect.objectContaining({ document: '11222333000181' }));
      expect(users.createUser).toHaveBeenCalledWith('store-1', expect.objectContaining({ role: 'admin' }));
      expect(result.user.is_platform_admin).toBe(false);
      expect(result.access_token).toBeTruthy();
    });

    it('should reject an invalid CNPJ before touching the database', async () => {
      await expect(register({ store_document: '11.222.333/0001-82' })).rejects.toThrow('valid CNPJ');
      await expect(register({ store_document: '12345678901' })).rejects.toThrow('valid CNPJ');
      expect(stores.createStore).not.toHaveBeenCalled();
    });

    it('should reject invalid emails', async () => {
      await expect(register({ admin_email: 'nope' })).rejects.toThrow('admin_email');
      await expect(register({ store_email: 'nope' })).rejects.toThrow('store_email');
    });

    it('should not create the store when the admin email is already taken', async () => {
      users.getUserByEmail.mockResolvedValue({ id: 'someone' });
      await expect(register()).rejects.toThrow('already exists');
      expect(stores.createStore).not.toHaveBeenCalled();
    });

    it('should undo the store when creating the admin fails, so the owner can retry', async () => {
      users.createUser.mockRejectedValue(new Error('Password must have at least 8 characters'));
      await expect(register()).rejects.toThrow('Password');
      expect(stores.hardDeleteStore).toHaveBeenCalledWith('store-1');
    });
  });

  describe('login', () => {
    const hash = bcrypt.hashSync('rightpassword', 4);
    const user = { id: 'u1', email: 'a@b.co', store_id: 's1', role: 'admin', active: true, password_hash: hash, is_platform_admin: false };

    it('should give the same error for unknown email and wrong password', async () => {
      users.getUserByEmail.mockResolvedValue(null);
      const unknown = await service.login({ email: 'ghost@x.co', password: 'whatever' }).catch((e) => e.message);

      users.getUserByEmail.mockResolvedValue(user);
      const wrong = await service.login({ email: 'a@b.co', password: 'wrongpassword' }).catch((e) => e.message);

      expect(unknown).toBe('Invalid credentials');
      expect(wrong).toBe('Invalid credentials');
    });

    it('should only reveal that the account is inactive after a correct password', async () => {
      users.getUserByEmail.mockResolvedValue({ ...user, active: false });
      expect(await service.login({ email: 'a@b.co', password: 'wrongpassword' }).catch((e) => e.message)).toBe('Invalid credentials');
      expect(await service.login({ email: 'a@b.co', password: 'rightpassword' }).catch((e) => e.message)).toBe('User account is inactive');
    });

    it('should log in with the right password', async () => {
      users.getUserByEmail.mockResolvedValue(user);
      const result = await service.login({ email: 'a@b.co', password: 'rightpassword' });
      expect(result.user.email).toBe('a@b.co');
      expect(service.verifyToken(result.access_token)).toMatchObject({ id: 'u1', store_id: 's1', role: 'admin' });
    });
  });

  it('should refuse to start in production without JWT_SECRET', () => {
    const { JWT_SECRET, NODE_ENV } = process.env;
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';
    try {
      expect(() => new AuthService()).toThrow('JWT_SECRET is required');
    } finally {
      if (JWT_SECRET !== undefined) process.env.JWT_SECRET = JWT_SECRET;
      process.env.NODE_ENV = NODE_ENV;
    }
  });
});
