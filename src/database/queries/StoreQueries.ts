import { Repository, FindOptionsWhere } from 'typeorm';
import { StoreModel } from '../models/StoreModel';

export class StoreQueries {
  constructor(private repository: Repository<StoreModel>) {}

  // CREATE
  async create(data: Partial<StoreModel>): Promise<StoreModel> {
    const store = this.repository.create(data);
    return this.repository.save(store);
  }

  // READ
  async findById(id: string): Promise<StoreModel | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['users', 'auditLogs'],
    });
  }

  async findByEmail(email: string): Promise<StoreModel | null> {
    return this.repository.findOne({
      where: { email },
    });
  }

  async findByDocument(document: string): Promise<StoreModel | null> {
    return this.repository.findOne({
      where: { document },
    });
  }

  async findAll(): Promise<StoreModel[]> {
    return this.repository.find({
      order: { created_at: 'DESC' },
    });
  }

  async findActive(): Promise<StoreModel[]> {
    return this.repository.find({
      where: { active: true },
      order: { created_at: 'DESC' },
    });
  }

  async findByCity(city: string): Promise<StoreModel[]> {
    return this.repository.find({
      where: { city, active: true },
      order: { name: 'ASC' },
    });
  }

  // UPDATE
  async update(id: string, data: Partial<StoreModel>): Promise<StoreModel | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  async toggleActive(id: string): Promise<StoreModel | null> {
    const store = await this.findById(id);
    if (!store) return null;
    return this.update(id, { active: !store.active });
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

  async countActive(): Promise<number> {
    return this.repository.count({ where: { active: true } });
  }

  async findWithUsers(id: string): Promise<StoreModel | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['users'],
    });
  }
}
