import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Check,
} from 'typeorm';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  READ = 'READ',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
}

export enum AuditStatus {
  SUCCESS = 'success',
  ERROR = 'error',
}

@Entity('audit_logs')
@Index(['store_id'])
@Index(['user_id'])
@Index(['created_at'])
@Index(['action'])
@Index(['entity_type'])
@Index(['store_id', 'created_at'])
@Check(`"action" IN ('CREATE', 'UPDATE', 'DELETE', 'READ', 'LOGIN', 'LOGOUT')`)
@Check(`"status" IN ('success', 'error')`)
export class AuditLogModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  store_id: string;

  @Column('uuid', { nullable: true })
  user_id?: string;

  @Column('varchar', { length: 50 })
  action: AuditAction;

  @Column('varchar', { length: 100 })
  entity_type: string;

  @Column('uuid', { nullable: true })
  entity_id?: string;

  @Column('jsonb', { nullable: true })
  old_values?: Record<string, any>;

  @Column('jsonb', { nullable: true })
  new_values?: Record<string, any>;

  @Column('varchar', { length: 45, nullable: true })
  ip_address?: string;

  @Column('text', { nullable: true })
  user_agent?: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('varchar', { length: 20, default: 'success' })
  status: AuditStatus;

  @Column('text', { nullable: true })
  error_message?: string;

  @CreateDateColumn()
  created_at: Date;
}
