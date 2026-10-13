import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export type SaleOrigin = 'ifood' | 'aiqfome' | 'manual' | 'app' | 'web';
export type SyncStatus = 'pending' | 'synced' | 'error' | 'cancelled';

@Entity('sale_integrations')
@Index(['origin'])
@Index(['external_id'])
@Index(['sync_status'])
@Index(['integration_id'])
export class SaleIntegrationModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { unique: true })
  sale_id: string;

  @Column('uuid')
  integration_id: string;

  @Column('varchar', { length: 20, default: 'manual' })
  origin: SaleOrigin;

  @Column('varchar', { length: 100, nullable: true })
  external_id?: string;

  @Column('varchar', { length: 100, nullable: true })
  external_order_number?: string;

  @Column('jsonb', { nullable: true })
  origin_data?: Record<string, unknown>;

  @Column('varchar', { length: 20, default: 'pending' })
  sync_status: SyncStatus;

  @Column('timestamp', { nullable: true })
  last_sync?: Date;

  @ManyToOne('SaleModel', 'integrations', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale?: any;
}
