import { SyncProcessor } from './SyncProcessor.js';

/**
 * Polls the sync outbox. Interval comes from AIQFOME_SYNC_INTERVAL_MS; it is DISABLED unless set to a positive
 * number, so nothing runs until a feature registers handlers and the environment turns it on.
 */
export function startSyncWorker(processor: SyncProcessor): NodeJS.Timeout | null {
  const intervalMs = parseInt(process.env.AIQFOME_SYNC_INTERVAL_MS ?? '0', 10);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    console.log('Sync worker disabled');
    return null;
  }

  let running = false;
  const timer = setInterval(async () => {
    if (running) return; // never overlap runs
    running = true;
    try {
      const processed = await processor.processDue();
      if (processed > 0) console.log(`Sync worker processed ${processed} job(s)`);
    } catch (err) {
      console.error('Sync worker error:', err instanceof Error ? err.message : err);
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref();

  console.log(`Sync worker started (every ${intervalMs}ms)`);
  return timer;
}
