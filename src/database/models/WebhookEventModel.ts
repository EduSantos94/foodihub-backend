import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type WebhookEventStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'skipped';

@Entity('webhook_events')
@Index(['webhook_id', 'status'])
@Index(['event_type'])
@Index(['created_at'])
@Index(['next_retry'])
@Index(['status'])
export class WebhookEventModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  webhook_id: string;

  @Column('varchar', { length: 100 })
  event_type: string;

  @Column('text')
  payload: string;

  @Column('int', { nullable: true })
  response_status?: number;

  @Column('text', { nullable: true })
  response_body?: string;

  @Column('varchar', { length: 20, default: 'pending' })
  status: WebhookEventStatus;

  @Column('int', { default: 0 })
  attempt_count: number;

  @Column('timestamp', { nullable: true })
  last_attempt?: Date;

  @Column('timestamp', { nullable: true })
  next_retry?: Date;

  @CreateDateColumn()
  created_at: Date;
}
