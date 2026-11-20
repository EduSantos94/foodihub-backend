import { Repository } from 'typeorm';
import { SyncOutboxModel } from '../models/SyncOutboxModel.js';

export interface SyncJobInput {
  integration_id: string;
  store_id: string;
  entity_type: string;
  entity_id: string;
  operation: string;
}

// pg unique_violation
const UNIQUE_VIOLATION = '23505';

export class SyncOutboxQueries {
  constructor(private repository: Repository<SyncOutboxModel>) {}

  /**
   * Queues a job. If one is already pending for the same record and operation the call is coalesced into it
   * (the worker always pushes the CURRENT value, so one pending job is enough). Returns true when a new job
   * was created.
   */
  async enqueue(job: SyncJobInput): Promise<boolean> {
    const result = await this.repository.query(
      `INSERT INTO sync_outbox (integration_id, store_id, entity_type, entity_id, operation)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (integration_id, entity_type, entity_id, operation) WHERE status = 'pending' DO NOTHING
       RETURNING id`,
      [job.integration_id, job.store_id, job.entity_type, job.entity_id, job.operation]
    );
    const rows = Array.isArray(result[0]) ? result[0] : result;
    return rows.length > 0;
  }

  /**
   * Atomically claims jobs that are due, for the given "entity_type:operation" keys only. Takes pending jobs whose
   * retry time was reached and jobs stuck in 'processing' for over 5 minutes (a worker that died). Jobs of inactive
   * integrations are left alone. FOR UPDATE SKIP LOCKED makes it safe to run more than one instance.
   */
  async claimDue(limit: number, supportedKeys: string[]): Promise<SyncOutboxModel[]> {
    if (supportedKeys.length === 0) return [];
    const result = await this.repository.query(
      `UPDATE sync_outbox
          SET status = 'processing', locked_at = NOW(), attempt_count = attempt_count + 1,
              next_retry = NULL, updated_at = NOW()
        WHERE id IN (
          SELECT s.id FROM sync_outbox s
           WHERE (s.entity_type || ':' || s.operation) = ANY($2)
             AND ((s.status = 'pending' AND (s.next_retry IS NULL OR s.next_retry <= NOW()))
               OR (s.status = 'processing' AND s.locked_at < NOW() - INTERVAL '5 minutes'))
             AND EXISTS (SELECT 1 FROM integrations i WHERE i.id = s.integration_id AND i.active = true)
           ORDER BY s.created_at
           LIMIT $1
           FOR UPDATE OF s SKIP LOCKED
        )
        RETURNING *`,
      [limit, supportedKeys]
    );
    // TypeORM returns [rows, rowCount] for UPDATE ... RETURNING on postgres
    return (Array.isArray(result[0]) ? result[0] : result) as SyncOutboxModel[];
  }

  async markDone(id: string): Promise<void> {
    await this.repository.query(
      `UPDATE sync_outbox SET status = 'done', locked_at = NULL, last_error = NULL, updated_at = NOW() WHERE id = $1`,
      [id]
    );
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.repository.query(
      `UPDATE sync_outbox SET status = 'failed', locked_at = NULL, last_error = $2, updated_at = NOW() WHERE id = $1`,
      [id, error]
    );
  }

  /**
   * Puts the job back to be retried in delayMinutes. If a newer pending job already exists for the same record
   * the retry is redundant (that job carries the latest value), so this one is closed instead; this also keeps
   * the "one pending job per record" unique index from being violated.
   */
  async scheduleRetry(id: string, delayMinutes: number, error: string): Promise<void> {
    try {
      await this.repository.query(
        `UPDATE sync_outbox s
            SET status = CASE WHEN EXISTS (
                  SELECT 1 FROM sync_outbox n
                   WHERE n.id <> s.id AND n.status = 'pending' AND n.integration_id = s.integration_id
                     AND n.entity_type = s.entity_type AND n.entity_id = s.entity_id AND n.operation = s.operation
                ) THEN 'done' ELSE 'pending' END,
                next_retry = NOW() + make_interval(mins => $3),
                locked_at = NULL, last_error = $2, updated_at = NOW()
          WHERE s.id = $1`,
        [id, error, delayMinutes]
      );
    } catch (err) {
      // A newer pending job was created between the check and the update
      if ((err as { driverError?: { code?: string } }).driverError?.code !== UNIQUE_VIOLATION) throw err;
      await this.repository.query(
        `UPDATE sync_outbox SET status = 'done', locked_at = NULL, last_error = $2, updated_at = NOW() WHERE id = $1`,
        [id, error]
      );
    }
  }

  /** Deletes finished jobs after `days` and failed ones after `failedDays`. Returns how many were removed. */
  async purgeOld(days: number, failedDays: number): Promise<number> {
    const result = await this.repository.query(
      `DELETE FROM sync_outbox
        WHERE (status = 'done' AND updated_at < NOW() - make_interval(days => $1))
           OR (status = 'failed' AND updated_at < NOW() - make_interval(days => $2))`,
      [days, failedDays]
    );
    return Array.isArray(result) ? Number(result[1] ?? 0) : 0;
  }
}
