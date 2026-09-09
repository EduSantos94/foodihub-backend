import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { createDataSource } from '../database/connection.js';
import { UserModel, UserRole } from '../database/models/UserModel.js';
import {
  CreateUserRequest,
  UpdateUserRequest,
  ChangePasswordRequest,
  UserResponse,
  PaginatedResponse,
  PaginationQuery,
} from '../types/index.js';

export class UserService {
  private userRepository?: Repository<UserModel>;

  private async ensureRepository() {
    if (!this.userRepository) {
      const dataSource = await createDataSource();
      this.userRepository = dataSource.getRepository(UserModel);
    }
  }

  async createUser(
    storeId: string,
    data: CreateUserRequest
  ): Promise<UserResponse> {
    await this.ensureRepository();
    const existingUser = await this.userRepository!.findOne({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const hashedPassword = await this.hashPassword(data.password);

    const user = this.userRepository!.create({
      store_id: storeId,
      email: data.email,
      password_hash: hashedPassword,
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone,
      role: (data.role || UserRole.STAFF) as UserRole,
      active: true,
    });

    const savedUser = await this.userRepository!.save(user);
    return this.mapToResponse(savedUser);
  }

  async getUserById(id: string): Promise<UserResponse> {
    await this.ensureRepository();
    const user = await this.userRepository!.findOne({
      where: { id },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return this.mapToResponse(user);
  }

  async getUserByEmail(email: string): Promise<UserModel | null> {
    await this.ensureRepository();
    return this.userRepository!.findOne({
      where: { email },
    });
  }

  async updateUser(
    id: string,
    data: UpdateUserRequest
  ): Promise<UserResponse> {
    await this.ensureRepository();
    const user = await this.userRepository!.findOne({
      where: { id },
    });

    if (!user) {
      throw new Error('User not found');
    }

    Object.assign(user, {
      first_name: data.first_name || user.first_name,
      last_name: data.last_name || user.last_name,
      phone: data.phone || user.phone,
      active: data.active !== undefined ? data.active : user.active,
    });

    user.updated_at = new Date();
    const updatedUser = await this.userRepository!.save(user);
    return this.mapToResponse(updatedUser);
  }

  async changePassword(
    id: string,
    data: ChangePasswordRequest
  ): Promise<void> {
    await this.ensureRepository();
    const user = await this.userRepository!.findOne({
      where: { id },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const passwordMatch = await bcrypt.compare(
      data.current_password,
      user.password_hash
    );

    if (!passwordMatch) {
      throw new Error('Current password is incorrect');
    }

    user.password_hash = await this.hashPassword(data.new_password);
    user.updated_at = new Date();
    await this.userRepository!.save(user);
  }

  async getUsersByStore(
    storeId: string,
    query: PaginationQuery
  ): Promise<PaginatedResponse<UserResponse>> {
    await this.ensureRepository();
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const [users, total] = await this.userRepository!.findAndCount({
      where: { store_id: storeId },
      skip,
      take: limit,
      order: {
        created_at: query.order || 'DESC',
      },
    });

    return {
      data: users.map((user) => this.mapToResponse(user)),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async deactivateUser(id: string): Promise<UserResponse> {
    await this.ensureRepository();
    const user = await this.userRepository!.findOne({
      where: { id },
    });

    if (!user) {
      throw new Error('User not found');
    }

    user.active = false;
    user.updated_at = new Date();

    const updatedUser = await this.userRepository!.save(user);
    return this.mapToResponse(updatedUser);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  private mapToResponse(user: UserModel): UserResponse {
    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      role: user.role,
      active: user.active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
}
