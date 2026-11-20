import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm';

export type ExternalEntityType = 'product' | 'product_size' | 'category' | 'payment_method' | 'customer';

/** Links a FoodiHub record to its counterpart on an external platform, per integration. */
@Entity('external_mappings')
@Index(['store_id'])
@Index(['integration_id', 'entity_type'])
@Unique('uq_external_mappings_local', ['integration_id', 'entity_type', 'local_id'])
@Unique('uq_external_mappings_external', ['integration_id', 'entity_type', 'external_id'])
export class ExternalMappingModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  integration_id: string;

  @Column('uuid')
  store_id: string;

  @Column('varchar', { length: 30 })
  entity_type: ExternalEntityType;

  // varchar, not uuid: payment methods are identified locally by a code such as 'pix'
  @Column('varchar', { length: 100 })
  local_id: string;

  @Column('varchar', { length: 255 })
  external_id: string;

  @Column('boolean', { default: true })
  sync_enabled: boolean;

  @Column('timestamp', { nullable: true })
  last_synced_at?: Date;

  @Column('varchar', { length: 64, nullable: true })
  last_synced_hash?: string;

  @Column('text', { nullable: true })
  last_error?: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
