import { SyncOutboxModel } from '../database/models/SyncOutboxModel.js';
import { SyncOutboxQueries } from '../database/queries/SyncOutboxQueries.js';
import { createDataSource } from '../database/connection.js';

/** Runs one job. Throw to fail it; throw NonRetryableSyncError when retrying cannot help. */
export type SyncHandler = (job: SyncOutboxModel) => Promise<void>;

export class NonRetryableSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableSyncError';
  }
}

// Minutes to wait before attempt N+1 (the last value is reused for any further attempt)
export const SYNC_RETRY_BACKOFF_MINUTES = [1, 5, 15, 60, 240];
export const SYNC_MAX_ATTEMPTS = 8;
const MAX_ERROR_LENGTH = 1000;

export function syncRetryDelayMinutes(attemptCount: number): number {
  const index = Math.min(Math.max(attemptCount, 1) - 1, SYNC_RETRY_BACKOFF_MINUTES.length - 1);
  return SYNC_RETRY_BACKOFF_MINUTES[index];
}

export const jobKey = (entityType: string, operation: string) => `${entityType}:${operation}`;

/**
 * Processes due outbox jobs with the registered handlers. Only jobs that have a handler are claimed, so jobs
 * for a platform feature that is not implemented yet are left untouched instead of being failed.
 */
export class SyncProcessor {
  constructor(
    private handlers: Record<string, SyncHandler>,
    private getQueries: () => Promise<SyncOutboxQueries> = defaultQueries
  ) {}

  /** Returns how many jobs were processed (successfully or not). */
  async processDue(limit = 20): Promise<number> {
    const q = await this.getQueries();
    const jobs = await q.claimDue(limit, Object.keys(this.handlers));
    await Promise.all(jobs.map((job) => this.run(q, job)));
    return jobs.length;
  }

  private async run(q: SyncOutboxQueries, job: SyncOutboxModel): Promise<void> {
    try {
      await this.handlers[jobKey(job.entity_type, job.operation)](job);
      await q.markDone(job.id);
    } catch (err) {
      const message = (err instanceof Error ? err.message : String(err)).slice(0, MAX_ERROR_LENGTH);
      const giveUp = err instanceof NonRetryableSyncError || job.attempt_count >= SYNC_MAX_ATTEMPTS;
      if (giveUp) await q.markFailed(job.id, message);
      else await q.scheduleRetry(job.id, syncRetryDelayMinutes(job.attempt_count), message);
    }
  }
}

async function defaultQueries(): Promise<SyncOutboxQueries> {
  const ds = await createDataSource();
  return new SyncOutboxQueries(ds.getRepository(SyncOutboxModel));
}
