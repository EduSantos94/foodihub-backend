import { Repository } from 'typeorm';
import { WebhookModel } from '../models/WebhookModel.js';
import { WebhookEventModel } from '../models/WebhookEventModel.js';

export interface WebhookTarget {
  webhook: WebhookModel;
  integration_active: boolean;
}

export class WebhookQueries {
  constructor(
    private webhookRepository: Repository<WebhookModel>,
    private eventRepository: Repository<WebhookEventModel>
  ) {}

  /** Active webhooks of active integrations of a store that listen to eventType. */
  async findActiveWebhooksForEvent(storeId: string, eventType: string): Promise<WebhookModel[]> {
    return this.webhookRepository
      .createQueryBuilder('w')
      .innerJoin('integrations', 'i', 'i.id = w.integration_id')
      .where('i.store_id = :storeId', { storeId })
      .andWhere('i.active = true')
      .andWhere('w.active = true')
      .andWhere('w.event_type = :eventType', { eventType })
      .getMany();
  }

  async createEvents(events: Partial<WebhookEventModel>[]): Promise<WebhookEventModel[]> {
    if (events.length === 0) return [];
    return this.eventRepository.save(this.eventRepository.create(events));
  }

  /**
   * Atomically claims events that are due (pending with next_retry reached, or stuck in 'sent'
   * for more than 5 minutes), marking them as 'sent' and counting the attempt.
   * FOR UPDATE SKIP LOCKED makes it safe to run in more than one instance.
   */
  async claimDueEvents(limit: number): Promise<WebhookEventModel[]> {
    const result = await this.eventRepository.query(
      `UPDATE webhook_events
          SET status = 'sent', attempt_count = attempt_count + 1, last_attempt = NOW(), next_retry = NULL
        WHERE id IN (
          SELECT id FROM webhook_events
           WHERE (status = 'pending' AND (next_retry IS NULL OR next_retry <= NOW()))
              OR (status = 'sent' AND last_attempt < NOW() - INTERVAL '5 minutes')
           ORDER BY created_at
           LIMIT $1
           FOR UPDATE SKIP LOCKED
        )
        RETURNING *`,
      [limit]
    );
    // TypeORM returns [rows, rowCount] for UPDATE ... RETURNING on postgres
    return (Array.isArray(result[0]) ? result[0] : result) as WebhookEventModel[];
  }

  async findWebhookTarget(webhookId: string): Promise<WebhookTarget | null> {
    const webhook = await this.webhookRepository.findOne({ where: { id: webhookId } });
    if (!webhook) return null;
    const rows = await this.webhookRepository.query(
      'SELECT active FROM integrations WHERE id = $1',
      [webhook.integration_id]
    );
    return { webhook, integration_active: rows.length > 0 && rows[0].active === true };
  }

  /**
   * Puts the event back in the queue to be retried in delayMinutes. The time is computed by
   * the database (NOW()) so it is consistent with claimDueEvents regardless of the app timezone
   * (the columns are timestamp without time zone).
   */
  async scheduleRetry(
    id: string,
    delayMinutes: number,
    responseStatus: number | undefined,
    responseBody: string | undefined
  ): Promise<void> {
    await this.eventRepository.query(
      `UPDATE webhook_events
          SET status = 'pending', response_status = $2, response_body = $3,
              next_retry = NOW() + make_interval(mins => $4)
        WHERE id = $1`,
      [id, responseStatus ?? null, responseBody ?? null, delayMinutes]
    );
  }

  /** Deletes old events: finished ones after `days`, failed ones after `failedDays`. */
  async purgeOldEvents(days: number, failedDays: number): Promise<number> {
    const result = await this.eventRepository.query(
      `DELETE FROM webhook_events
        WHERE (status IN ('delivered', 'skipped') AND created_at < NOW() - make_interval(days => $1))
           OR (status = 'failed' AND created_at < NOW() - make_interval(days => $2))`,
      [days, failedDays]
    );
    // pg returns [rows, rowCount] for DELETE
    return Array.isArray(result) ? Number(result[1] ?? 0) : 0;
  }

  async updateEvent(id: string, data: Partial<WebhookEventModel>): Promise<void> {
    await this.eventRepository.update({ id }, data);
  }
}
