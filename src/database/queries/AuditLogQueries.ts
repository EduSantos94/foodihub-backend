import { Repository, Between } from 'typeorm';
import { AuditLogModel, AuditAction, AuditStatus } from '../models/AuditLogModel';

export class AuditLogQueries {
  constructor(private repository: Repository<AuditLogModel>) {}

  // CREATE
  async create(data: Partial<AuditLogModel>): Promise<AuditLogModel> {
    const log = this.repository.create(data);
    return this.repository.save(log);
  }

  // READ
  async findById(id: string): Promise<AuditLogModel | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['store', 'user'],
    });
  }

  async findByStoreId(storeId: string, limit: number = 100): Promise<AuditLogModel[]> {
    return this.repository.find({
      where: { store_id: storeId },
      relations: ['store', 'user'],
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async findByUserId(userId: string, limit: number = 50): Promise<AuditLogModel[]> {
    return this.repository.find({
      where: { user_id: userId },
      relations: ['store', 'user'],
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async findByAction(action: AuditAction, limit: number = 100): Promise<AuditLogModel[]> {
    return this.repository.find({
      where: { action },
      relations: ['store', 'user'],
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async findByEntityType(entityType: string, limit: number = 100): Promise<AuditLogModel[]> {
    return this.repository.find({
      where: { entity_type: entityType },
      relations: ['store', 'user'],
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async findByEntityId(entityId: string): Promise<AuditLogModel[]> {
    return this.repository.find({
      where: { entity_id: entityId },
      relations: ['store', 'user'],
      order: { created_at: 'DESC' },
    });
  }

  async findByStoreAndEntity(
    storeId: string,
    entityType: string,
    entityId?: string
  ): Promise<AuditLogModel[]> {
    const query = this.repository
      .createQueryBuilder('log')
      .where('log.store_id = :storeId', { storeId })
      .andWhere('log.entity_type = :entityType', { entityType });

    if (entityId) {
      query.andWhere('log.entity_id = :entityId', { entityId });
    }

    return query.orderBy('log.created_at', 'DESC').getMany();
  }

  async findByDateRange(startDate: Date, endDate: Date, limit: number = 1000): Promise<AuditLogModel[]> {
    return this.repository.find({
      where: { created_at: Between(startDate, endDate) },
      relations: ['store', 'user'],
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async findByStoreAndDateRange(
    storeId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 500
  ): Promise<AuditLogModel[]> {
    return this.repository.find({
      where: {
        store_id: storeId,
        created_at: Between(startDate, endDate),
      },
      relations: ['store', 'user'],
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async findByStatus(status: AuditStatus): Promise<AuditLogModel[]> {
    return this.repository.find({
      where: { status },
      relations: ['store', 'user'],
      order: { created_at: 'DESC' },
    });
  }

  // ANALYTICS
  async countByStore(storeId: string): Promise<number> {
    return this.repository.count({ where: { store_id: storeId } });
  }

  async countByStoreAndAction(storeId: string, action: AuditAction): Promise<number> {
    return this.repository.count({
      where: { store_id: storeId, action },
    });
  }

  async countErrors(): Promise<number> {
    return this.repository.count({ where: { status: AuditStatus.ERROR } });
  }

  async countErrorsByStore(storeId: string): Promise<number> {
    return this.repository.count({
      where: { store_id: storeId, status: AuditStatus.ERROR },
    });
  }

  async getActivitySummary(storeId: string): Promise<Record<string, number>> {
    const logs = await this.findByStoreId(storeId, 1000);
    const summary: Record<AuditAction, number> = {
      CREATE: 0,
      UPDATE: 0,
      DELETE: 0,
      READ: 0,
      LOGIN: 0,
      LOGOUT: 0,
    };

    logs.forEach((log) => {
      summary[log.action]++;
    });

    return summary;
  }

  // DELETE - Usually we don't delete audit logs, but keeping for completeness
  async deleteOlderThan(days: number): Promise<number> {
    const date = new Date();
    date.setDate(date.getDate() - days);

    const result = await this.repository.delete({
      created_at: Between(new Date('1970-01-01'), date),
    });

    return result.affected || 0;
  }
}
