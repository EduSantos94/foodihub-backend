import jwt from 'jsonwebtoken';
import { UserService } from './UserService.js';
import { StoreService } from './StoreService.js';
import bcrypt from 'bcryptjs';
import { LoginRequest, RegisterRequest, LoginResponse } from '../types/index.js';
import { isValidCnpj, onlyDigits } from '../utils/cnpj.js';

// Compared against when the email is unknown, so "no such user" takes as long as "wrong password"
const DUMMY_HASH = bcrypt.hashSync('foodihub-dummy-password', 10);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthService {
  private userService: UserService;
  private storeService: StoreService;
  private jwtSecret: string;

  constructor() {
    this.userService = new UserService();
    this.storeService = new StoreService();
    const secret = process.env.JWT_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is required in production');
    }
    this.jwtSecret = secret || 'supersecret';
  }

  async login(data: LoginRequest): Promise<LoginResponse> {
    const user = await this.userService.getUserByEmail(String(data.email));

    // Same answer and same cost whether the email exists or the password is wrong
    const passwordMatch = await this.userService.verifyPassword(
      String(data.password),
      user?.password_hash ?? DUMMY_HASH
    );

    if (!user || !passwordMatch) {
      throw new Error('Invalid credentials');
    }

    // Only someone who proved the password learns that the account is inactive
    if (!user.active) {
      throw new Error('User account is inactive');
    }

    const token = this.generateToken({
      id: user.id,
      email: user.email,
      store_id: user.store_id,
      role: user.role,
    });

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        role: user.role,
        active: user.active,
        is_platform_admin: user.is_platform_admin === true,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    };
  }

  async register(data: RegisterRequest): Promise<LoginResponse> {
    // A store is identified by its CNPJ (stored as digits only)
    if (!isValidCnpj(String(data.store_document))) {
      throw new Error('store_document must be a valid CNPJ');
    }
    const document = onlyDigits(String(data.store_document));

    if (!EMAIL_RE.test(String(data.store_email))) throw new Error('store_email must be a valid email');
    if (!EMAIL_RE.test(String(data.admin_email))) throw new Error('admin_email must be a valid email');

    // Fail before creating anything, so a taken email does not leave an orphan store behind
    if (await this.userService.getUserByEmail(data.admin_email)) {
      throw new Error('User with this email already exists');
    }

    // Criar loja
    const store = await this.storeService.createStore({
      name: data.store_name,
      email: data.store_email,
      document,
    });

    // Criar usuário admin (always a plain store admin: never a platform admin)
    let user;
    try {
      user = await this.userService.createUser(store.id, {
        email: data.admin_email,
        password: data.admin_password,
        first_name: data.admin_first_name,
        last_name: data.admin_last_name,
        role: 'admin',
      });
    } catch (error) {
      // Undo the store so the owner can fix the problem (weak password, race on the email) and retry
      await this.storeService.hardDeleteStore(store.id);
      throw error;
    }

    const token = this.generateToken({
      id: user.id,
      email: user.email,
      store_id: store.id,
      role: user.role,
    });

    return {
      access_token: token,
      user,
    };
  }

  verifyToken(token: string): Record<string, any> {
    try {
      return jwt.verify(token, this.jwtSecret) as Record<string, any>;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  private generateToken(payload: Record<string, any>): string {
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: '24h',
    });
  }
}
