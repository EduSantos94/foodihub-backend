import { describe, it, expect, vi } from 'vitest';
import {
  SyncProcessor,
  NonRetryableSyncError,
  syncRetryDelayMinutes,
  SYNC_MAX_ATTEMPTS,
} from '../SyncProcessor.js';

vi.mock('../../database/connection.js', () => ({ createDataSource: vi.fn() }));

const job = (over: Record<string, unknown> = {}) =>
  ({ id: 'j1', entity_type: 'product', operation: 'stock', attempt_count: 1, ...over }) as any;

const fakeQueries = (jobs: any[]) => ({
  claimDue: vi.fn().mockResolvedValue(jobs),
  markDone: vi.fn().mockResolvedValue(undefined),
  markFailed: vi.fn().mockResolvedValue(undefined),
  scheduleRetry: vi.fn().mockResolvedValue(undefined),
});

describe('syncRetryDelayMinutes', () => {
  it('backs off 1, 5, 15, 60, 240 and stays at 240', () => {
    expect([1, 2, 3, 4, 5, 6, 30].map(syncRetryDelayMinutes)).toEqual([1, 5, 15, 60, 240, 240, 240]);
  });
});

describe('SyncProcessor', () => {
  it('claims only the keys it has handlers for', async () => {
    const q = fakeQueries([]);
    const p = new SyncProcessor({ 'product:stock': vi.fn(), 'product:item': vi.fn() }, async () => q as any);
    expect(await p.processDue(5)).toBe(0);
    expect(q.claimDue).toHaveBeenCalledWith(5, ['product:stock', 'product:item']);
  });

  it('marks a job done when its handler succeeds', async () => {
    const q = fakeQueries([job()]);
    const handler = vi.fn().mockResolvedValue(undefined);
    expect(await new SyncProcessor({ 'product:stock': handler }, async () => q as any).processDue()).toBe(1);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: 'j1' }));
    expect(q.markDone).toHaveBeenCalledWith('j1');
    expect(q.scheduleRetry).not.toHaveBeenCalled();
  });

  it('schedules a retry with backoff when the handler fails', async () => {
    const q = fakeQueries([job({ attempt_count: 2 })]);
    const p = new SyncProcessor({ 'product:stock': vi.fn().mockRejectedValue(new Error('aiqfome down')) }, async () => q as any);
    await p.processDue();
    expect(q.scheduleRetry).toHaveBeenCalledWith('j1', 5, 'aiqfome down');
    expect(q.markDone).not.toHaveBeenCalled();
  });

  it('fails the job for good on a non-retryable error or after the max attempts', async () => {
    const q1 = fakeQueries([job()]);
    await new SyncProcessor({ 'product:stock': vi.fn().mockRejectedValue(new NonRetryableSyncError('unmapped product')) }, async () => q1 as any).processDue();
    expect(q1.markFailed).toHaveBeenCalledWith('j1', 'unmapped product');
    expect(q1.scheduleRetry).not.toHaveBeenCalled();

    const q2 = fakeQueries([job({ attempt_count: SYNC_MAX_ATTEMPTS })]);
    await new SyncProcessor({ 'product:stock': vi.fn().mockRejectedValue(new Error('still down')) }, async () => q2 as any).processDue();
    expect(q2.markFailed).toHaveBeenCalledWith('j1', 'still down');
  });

  it('one failing job does not stop the others, and long errors are truncated', async () => {
    const q = fakeQueries([job({ id: 'a' }), job({ id: 'b' })]);
    const handler = vi.fn().mockRejectedValueOnce(new Error('x'.repeat(5000))).mockResolvedValueOnce(undefined);
    await new SyncProcessor({ 'product:stock': handler }, async () => q as any).processDue();
    expect(q.markDone).toHaveBeenCalledWith('b');
    expect(q.scheduleRetry.mock.calls[0][2].length).toBe(1000);
  });
});
