import { WebhookDispatcher } from './WebhookDispatcher.js';

/**
 * Polls for due webhook events. Interval comes from WEBHOOK_WORKER_INTERVAL_MS
 * (default 30000); set it to 0 to disable the worker.
 */
export function startWebhookWorker(dispatcher = new WebhookDispatcher()): NodeJS.Timeout | null {
  const intervalMs = parseInt(process.env.WEBHOOK_WORKER_INTERVAL_MS ?? '30000', 10);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    console.log('Webhook worker disabled');
    return null;
  }

  const retentionDays = parseInt(process.env.WEBHOOK_RETENTION_DAYS ?? '30', 10);
  const failedRetentionDays = parseInt(process.env.WEBHOOK_FAILED_RETENTION_DAYS ?? '90', 10);
  const PURGE_EVERY_MS = 6 * 60 * 60 * 1000;
  let lastPurge = 0;

  let running = false;
  const timer = setInterval(async () => {
    if (running) return; // never overlap runs
    running = true;
    try {
      const processed = await dispatcher.processDue();
      if (processed > 0) console.log(`Webhook worker processed ${processed} event(s)`);

      if (Date.now() - lastPurge >= PURGE_EVERY_MS) {
        lastPurge = Date.now();
        const purged = await dispatcher.purgeOld(retentionDays, failedRetentionDays);
        if (purged > 0) console.log(`Webhook worker purged ${purged} old event(s)`);
      }
    } catch (err) {
      console.error('Webhook worker error:', err);
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref();

  console.log(`Webhook worker started (every ${intervalMs}ms)`);
  return timer;
}
