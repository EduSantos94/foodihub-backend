import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { RUN, createTestStore, TestStore } from './helpers.js';
import { SyncOutboxQueries } from '../database/queries/SyncOutboxQueries.js';
import { SyncOutboxModel } from '../database/models/SyncOutboxModel.js';

describe.skipIf(!RUN)('sync outbox (real database)', () => {
  let t: TestStore;
  let q: SyncOutboxQueries;
  let integrationId: string;

  const job = (entityId = 'p1', operation = 'stock', entityType = 'product') => ({
    integration_id: integrationId,
    store_id: t.storeId,
    entity_type: entityType,
    entity_id: entityId,
    operation,
  });
  const rows = (where = '') => t.ds.query(`SELECT * FROM sync_outbox WHERE integration_id = $1 ${where} ORDER BY created_at`, [integrationId]);

  beforeAll(async () => {
    t = await createTestStore('outbox');
    q = new SyncOutboxQueries(t.ds.getRepository(SyncOutboxModel));
    integrationId = (
      await t.ds.query("INSERT INTO integrations(store_id, name, type, status) VALUES ($1, 'aiqfome', 'aiqfome', 'active') RETURNING id", [t.storeId])
    )[0].id;
  });

  beforeEach(async () => {
    await t.ds.query('DELETE FROM sync_outbox WHERE integration_id = $1', [integrationId]);
    await t.ds.query('UPDATE integrations SET active = true WHERE id = $1', [integrationId]);
  });

  afterAll(async () => {
    await t?.ds.query('DELETE FROM integrations WHERE id = $1', [integrationId]);
    await t?.cleanup();
  });

  it('coalesces repeated changes into one pending job, but queues again once it is being processed', async () => {
    expect(await q.enqueue(job())).toBe(true);
    expect(await q.enqueue(job())).toBe(false);
    expect(await q.enqueue(job('p1', 'item'))).toBe(true); // other operation
    expect(await rows()).toHaveLength(2);

    await q.claimDue(10, ['product:stock']);
    expect(await q.enqueue(job())).toBe(true); // the claimed job no longer counts as pending
    expect(await rows("AND operation = 'stock'")).toHaveLength(2);
  });

  it('claims only supported keys, marks them processing and counts the attempt', async () => {
    await q.enqueue(job('p1', 'stock'));
    await q.enqueue(job('c1', 'item', 'category'));

    expect(await q.claimDue(10, [])).toEqual([]);
    const claimed = await q.claimDue(10, ['product:stock']);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({ entity_id: 'p1', status: 'processing', attempt_count: 1 });
    expect((await rows("AND entity_type = 'category'"))[0].status).toBe('pending'); // untouched
    expect(await q.claimDue(10, ['product:stock'])).toEqual([]); // not claimed twice
  });

  it('skips jobs of inactive integrations', async () => {
    await q.enqueue(job());
    await t.ds.query('UPDATE integrations SET active = false WHERE id = $1', [integrationId]);
    expect(await q.claimDue(10, ['product:stock'])).toEqual([]);
  });

  it('reclaims a job stuck in processing for over 5 minutes', async () => {
    await q.enqueue(job());
    await q.claimDue(10, ['product:stock']);
    expect(await q.claimDue(10, ['product:stock'])).toEqual([]);

    await t.ds.query("UPDATE sync_outbox SET locked_at = NOW() - INTERVAL '6 minutes' WHERE integration_id = $1", [integrationId]);
    const reclaimed = await q.claimDue(10, ['product:stock']);
    expect(reclaimed).toHaveLength(1);
    expect(reclaimed[0].attempt_count).toBe(2);
  });

  it('retries with a delay, then becomes due again', async () => {
    await q.enqueue(job());
    const [claimed] = await q.claimDue(10, ['product:stock']);
    await q.scheduleRetry(claimed.id, 10, 'aiqfome down');

    const [row] = await rows();
    expect(row).toMatchObject({ status: 'pending', last_error: 'aiqfome down', locked_at: null });
    expect(await q.claimDue(10, ['product:stock'])).toEqual([]); // 10 minutes away

    await t.ds.query("UPDATE sync_outbox SET next_retry = NOW() - INTERVAL '1 second' WHERE id = $1", [claimed.id]);
    expect(await q.claimDue(10, ['product:stock'])).toHaveLength(1);
  });

  it('closes a retry that a newer pending job already supersedes (no unique violation)', async () => {
    await q.enqueue(job());
    const [claimed] = await q.claimDue(10, ['product:stock']);
    await q.enqueue(job()); // a newer change arrived while the first was in flight

    await q.scheduleRetry(claimed.id, 5, 'failed once');
    const all = await rows();
    expect(all.filter((r: any) => r.status === 'pending')).toHaveLength(1);
    expect(all.find((r: any) => r.id === claimed.id).status).toBe('done');
  });

  it('marks done and failed, and purges old finished jobs only', async () => {
    await q.enqueue(job('a'));
    await q.enqueue(job('b'));
    await q.enqueue(job('c'));
    const claimed = await q.claimDue(10, ['product:stock']);
    const byEntity = (id: string) => claimed.find((c) => c.entity_id === id)!.id;

    await q.markDone(byEntity('a'));
    await q.markFailed(byEntity('b'), 'bad data');
    expect((await rows("AND entity_id = 'b'"))[0]).toMatchObject({ status: 'failed', last_error: 'bad data' });

    await t.ds.query("UPDATE sync_outbox SET updated_at = NOW() - INTERVAL '40 days' WHERE integration_id = $1", [integrationId]);
    expect(await q.purgeOld(7, 30)).toBe(2); // done (a) and failed (b) are old; 'c' is still processing
    expect((await rows()).map((r: any) => r.entity_id)).toEqual(['c']);
  });
});
