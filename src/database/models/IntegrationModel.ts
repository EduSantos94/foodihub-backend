import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { encryptedColumn } from '../../utils/crypto.js';

export type IntegrationType = 'ifood' | 'aiqfome' | 'custom';
export type IntegrationStatus = 'active' | 'inactive' | 'error';

@Entity('integrations')
@Index(['store_id', 'status'])
@Index(['store_id', 'active'])
@Index(['type'])
@Unique(['store_id', 'type'])
export class IntegrationModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  store_id: string;

  @Column('varchar', { length: 100 })
  name: string;

  @Column('varchar', { length: 20 })
  type: IntegrationType;

  // Stored encrypted (AES-256-GCM); the transformer is transparent to the code
  @Column('varchar', { length: 500, nullable: true, transformer: encryptedColumn })
  api_key?: string;

  @Column('varchar', { length: 500, nullable: true, transformer: encryptedColumn })
  api_secret?: string;

  @Column('varchar', { length: 500, nullable: true })
  webhook_url?: string;

  @Column('varchar', { length: 100, nullable: true })
  webhook_token?: string;

  @Column('varchar', { length: 20, default: 'inactive' })
  status: IntegrationStatus;

  @Column('timestamp', { nullable: true })
  last_sync?: Date;

  @Column('text', { nullable: true })
  last_error?: string;

  @Column('jsonb', { nullable: true })
  config?: Record<string, unknown>;

  @Column('boolean', { default: true })
  active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
