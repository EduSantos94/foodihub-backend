import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('webhooks')
@Index(['integration_id', 'event_type'])
@Index(['active'])
@Index(['event_type'])
export class WebhookModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  integration_id: string;

  @Column('varchar', { length: 100 })
  event_type: string;

  @Column('varchar', { length: 500 })
  endpoint_url: string;

  @Column('varchar', { length: 100 })
  webhook_token: string;

  @Column('boolean', { default: true })
  active: boolean;

  @Column('int', { default: 0 })
  retry_count: number;

  @Column('int', { default: 5 })
  max_retries: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
