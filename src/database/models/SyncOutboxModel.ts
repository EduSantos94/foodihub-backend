import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type SyncJobStatus = 'pending' | 'processing' | 'done' | 'failed';

/** A change waiting to be pushed to an external platform (one pending job per record and operation). */
@Entity('sync_outbox')
@Index(['status', 'next_retry'])
@Index(['integration_id', 'status'])
@Index(['store_id'])
export class SyncOutboxModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  integration_id: string;

  @Column('uuid')
  store_id: string;

  @Column('varchar', { length: 30 })
  entity_type: string;

  @Column('varchar', { length: 100 })
  entity_id: string;

  @Column('varchar', { length: 30 })
  operation: string;

  @Column('varchar', { length: 20, default: 'pending' })
  status: SyncJobStatus;

  @Column('int', { default: 0 })
  attempt_count: number;

  @Column('timestamp', { nullable: true })
  next_retry?: Date | null;

  @Column('timestamp', { nullable: true })
  locked_at?: Date | null;

  @Column('text', { nullable: true })
  last_error?: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
