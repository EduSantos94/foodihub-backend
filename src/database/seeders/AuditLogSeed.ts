import { Repository } from 'typeorm';
import { AuditLogModel, AuditAction, AuditStatus } from '../models/AuditLogModel';

export class AuditLogSeed {
  constructor(private repository: Repository<AuditLogModel>) {}

  async seedLoginAudit(storeId: string, userId: string, ipAddress: string = '127.0.0.1'): Promise<AuditLogModel> {
    const log = this.repository.create({
      store_id: storeId,
      user_id: userId,
      action: AuditAction.LOGIN,
      entity_type: 'User',
      entity_id: userId,
      ip_address: ipAddress,
      description: 'User login',
      status: AuditStatus.SUCCESS,
    } as any);

    return (await this.repository.save(log)) as unknown as AuditLogModel;
  }

  async deleteAll(): Promise<number> {
    const result = await this.repository.delete({});
    return result.affected || 0;
  }
}
