import jwt from 'jsonwebtoken';
import { UserService } from './UserService.js';
import { StoreService } from './StoreService.js';
import { LoginRequest, RegisterRequest, LoginResponse } from '../types/index.js';

export class AuthService {
  private userService: UserService;
  private storeService: StoreService;
  private jwtSecret: string;

  constructor() {
    this.userService = new UserService();
    this.storeService = new StoreService();
    this.jwtSecret = process.env.JWT_SECRET || 'supersecret';
  }

  async login(data: LoginRequest): Promise<LoginResponse> {
    const user = await this.userService.getUserByEmail(data.email);

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.active) {
      throw new Error('User account is inactive');
    }

    const passwordMatch = await this.userService.verifyPassword(
      data.password,
      user.password_hash
    );

    if (!passwordMatch) {
      throw new Error('Invalid credentials');
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
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    };
  }

  async register(data: RegisterRequest): Promise<LoginResponse> {
    // Criar loja
    const store = await this.storeService.createStore({
      name: data.store_name,
      email: data.store_email,
      document: data.store_document,
    });

    // Criar usuário admin
    const user = await this.userService.createUser(store.id, {
      email: data.admin_email,
      password: data.admin_password,
      first_name: data.admin_first_name,
      last_name: data.admin_last_name,
      role: 'admin',
    });

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
