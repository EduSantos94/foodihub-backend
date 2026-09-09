import { Repository } from 'typeorm';
import { UserModel, UserRole } from '../models/UserModel';

export class UserQueries {
  constructor(private repository: Repository<UserModel>) {}

  // CREATE
  async create(data: Partial<UserModel>): Promise<UserModel> {
    const user = this.repository.create(data);
    return this.repository.save(user);
  }

  // READ
  async findById(id: string): Promise<UserModel | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['store', 'auditLogs'],
    });
  }

  async findByEmail(email: string): Promise<UserModel | null> {
    return this.repository.findOne({
      where: { email },
      relations: ['store'],
    });
  }

  async findByStoreId(storeId: string): Promise<UserModel[]> {
    return this.repository.find({
      where: { store_id: storeId, active: true },
      relations: ['store'],
      order: { created_at: 'DESC' },
    });
  }

  async findAdminsByStoreId(storeId: string): Promise<UserModel[]> {
    return this.repository.find({
      where: { store_id: storeId, role: UserRole.ADMIN, active: true },
      order: { created_at: 'DESC' },
    });
  }

  async findByRole(role: UserRole): Promise<UserModel[]> {
    return this.repository.find({
      where: { role, active: true },
      relations: ['store'],
      order: { created_at: 'DESC' },
    });
  }

  async findAll(): Promise<UserModel[]> {
    return this.repository.find({
      relations: ['store'],
      order: { created_at: 'DESC' },
    });
  }

  async findActive(): Promise<UserModel[]> {
    return this.repository.find({
      where: { active: true },
      relations: ['store'],
      order: { created_at: 'DESC' },
    });
  }

  async findByStoreAndRole(storeId: string, role: UserRole): Promise<UserModel[]> {
    return this.repository.find({
      where: { store_id: storeId, role, active: true },
      order: { created_at: 'DESC' },
    });
  }

  // UPDATE
  async update(id: string, data: Partial<UserModel>): Promise<UserModel | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  async updateLastLogin(id: string): Promise<UserModel | null> {
    return this.update(id, { last_login: new Date() });
  }

  async toggleActive(id: string): Promise<UserModel | null> {
    const user = await this.findById(id);
    if (!user) return null;
    return this.update(id, { active: !user.active });
  }

  async updateRole(id: string, role: UserRole): Promise<UserModel | null> {
    return this.update(id, { role });
  }

  // DELETE
  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected || 0) > 0;
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repository.softDelete(id);
    return (result.affected || 0) > 0;
  }

  async restore(id: string): Promise<boolean> {
    const result = await this.repository.restore(id);
    return (result.affected || 0) > 0;
  }

  // ANALYTICS
  async countTotal(): Promise<number> {
    return this.repository.count();
  }

  async countByStore(storeId: string): Promise<number> {
    return this.repository.count({ where: { store_id: storeId } });
  }

  async countAdminsByStore(storeId: string): Promise<number> {
    return this.repository.count({
      where: { store_id: storeId, role: UserRole.ADMIN },
    });
  }

  async isEmailUnique(email: string, excludeId?: string): Promise<boolean> {
    const query = this.repository.createQueryBuilder('user').where('user.email = :email', { email });

    if (excludeId) {
      query.andWhere('user.id != :id', { id: excludeId });
    }

    const user = await query.getOne();
    return !user;
  }
}
