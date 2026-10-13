import http from 'node:http';
import { createHmac } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RUN, createTestStore, TestStore } from './helpers.js';
import { SaleService } from '../services/SaleService.js';
import { IntegrationService } from '../services/IntegrationService.js';
import { WebhookDispatcher } from '../services/WebhookDispatcher.js';

describe.skipIf(!RUN)('integrations & webhooks (real database)', () => {
  let t: TestStore;
  let server: http.Server;
  let port: number;
  let productId: string;
  const received: { headers: http.IncomingHttpHeaders; body: string }[] = [];
  const sales = new SaleService();
  const integ = new IntegrationService();
  const dispatcher = new WebhookDispatcher();

  beforeAll(async () => {
    process.env.WEBHOOK_ALLOW_PRIVATE = 'true'; // the receiver below listens on 127.0.0.1
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (d) => (body += d));
      req.on('end', () => {
        if (req.url === '/ok') {
          received.push({ headers: req.headers, body });
          res.writeHead(200).end('thanks');
        } else {
          res.writeHead(500).end('nope');
        }
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
    port = (server.address() as any).port;

    t = await createTestStore('webhooks');
    productId = (await t.ds.query("INSERT INTO products(store_id, name, price, amount) VALUES ($1, 'Cookie', 4.50, 100) RETURNING id", [t.storeId]))[0].id;
  });

  afterAll(async () => {
    delete process.env.WEBHOOK_ALLOW_PRIVATE;
    server?.close();
    await t?.cleanup();
  });

  it('stores api_key/api_secret encrypted but returns no secrets', async () => {
    const created = await integ.createIntegration(t.storeId, { name: 'Custom', type: 'custom', api_key: 'plain-key', api_secret: 'plain-secret' });
    expect(created).not.toHaveProperty('api_key');
    expect(created.has_api_key).toBe(true);

    const [raw] = await t.ds.query('SELECT api_key, api_secret FROM integrations WHERE id = $1', [created.id]);
    expect(raw.api_key).toMatch(/^enc:v1:/);
    expect(raw.api_key).not.toContain('plain-key');
    expect(raw.api_secret).toMatch(/^enc:v1:/);

    const model = await t.ds.getRepository('IntegrationModel').findOneBy({ id: created.id } as any);
    expect((model as any).api_key).toBe('plain-key');
  });

  it('delivers, signs, retries with backoff, gives up, and can be retried manually', async () => {
    const i = (await integ.listIntegrations(t.storeId, {})).data[0];
    const good = await integ.createWebhook(i.id, t.storeId, { event_type: 'order.created', endpoint_url: `http://127.0.0.1:${port}/ok` });
    const bad = await integ.createWebhook(i.id, t.storeId, { event_type: 'order.created', endpoint_url: `http://127.0.0.1:${port}/fail`, max_retries: 2 });

    const sale = await sales.createSale(t.storeId, undefined, { items: [{ product_id: productId, quantity: 1 }] });
    expect(await dispatcher.processDue()).toBe(2);

    const delivered = (await t.ds.query('SELECT * FROM webhook_events WHERE webhook_id = $1', [good.id]))[0];
    expect(delivered).toMatchObject({ status: 'delivered', response_status: 200, attempt_count: 1 });
    const hit = received[received.length - 1];
    expect(hit.headers['x-webhook-signature']).toBe('sha256=' + createHmac('sha256', good.webhook_token).update(hit.body).digest('hex'));
    expect(JSON.parse(hit.body).data.id).toBe(sale.id);

    // 500 -> pending with next_retry in the future, computed by the database (timezone-safe)
    let failing = (await t.ds.query('SELECT * FROM webhook_events WHERE webhook_id = $1', [bad.id]))[0];
    expect(failing.status).toBe('pending');
    expect(failing.response_status).toBe(500);
    const [{ in_future }] = await t.ds.query('SELECT next_retry > NOW() AS in_future FROM webhook_events WHERE id = $1', [failing.id]);
    expect(in_future).toBe(true);
    expect(await dispatcher.processDue()).toBe(0);

    // second attempt reaches max_retries=2 -> failed
    await t.ds.query('UPDATE webhook_events SET next_retry = NOW() WHERE id = $1', [failing.id]);
    await dispatcher.processDue();
    failing = (await t.ds.query('SELECT * FROM webhook_events WHERE id = $1', [failing.id]))[0];
    expect(failing).toMatchObject({ status: 'failed', attempt_count: 2, next_retry: null });

    const retried = await integ.retryEvent(failing.id, i.id, t.storeId);
    expect(retried).toMatchObject({ status: 'pending', attempt_count: 0 });

    // skipped when the webhook is switched off
    await integ.updateWebhook(bad.id, i.id, t.storeId, { active: false });
    await dispatcher.processDue();
    const skipped = (await t.ds.query('SELECT status FROM webhook_events WHERE id = $1', [failing.id]))[0];
    expect(skipped.status).toBe('skipped');
  });

  it('purges old finished events but keeps recent ones', async () => {
    const i = (await integ.listIntegrations(t.storeId, {})).data[0];
    const wh = (await integ.listWebhooks(i.id, t.storeId))[0];
    await t.ds.query("INSERT INTO webhook_events(webhook_id, event_type, payload, status, created_at) VALUES ($1, 'order.created', '{}', 'delivered', NOW() - INTERVAL '40 days')", [wh.id]);
    await t.ds.query("INSERT INTO webhook_events(webhook_id, event_type, payload, status, created_at) VALUES ($1, 'order.created', '{}', 'failed', NOW() - INTERVAL '40 days')", [wh.id]);

    const purged = await dispatcher.purgeOld(30, 90);

    expect(purged).toBe(1); // only the old delivered one; failed is kept up to 90 days
    const left = await t.ds.query("SELECT count(*)::int c FROM webhook_events WHERE created_at < NOW() - INTERVAL '30 days'");
    expect(left[0].c).toBeGreaterThanOrEqual(1);
  });

  it('exposes the report views', async () => {
    await expect(t.ds.query('SELECT * FROM vw_sales_by_status WHERE store_id = $1', [t.storeId])).resolves.toBeInstanceOf(Array);
    const top = await t.ds.query('SELECT * FROM vw_top_products WHERE store_id = $1', [t.storeId]);
    expect(top[0]).toMatchObject({ name: 'Cookie' });
    await expect(t.ds.query('SELECT * FROM vw_integration_status WHERE store_id = $1', [t.storeId])).resolves.toHaveLength(1);
    await expect(t.ds.query('SELECT * FROM vw_webhook_errors WHERE store_id = $1', [t.storeId])).resolves.toBeInstanceOf(Array);
    await expect(t.ds.query('SELECT * FROM vw_supplies_stock WHERE store_id = $1', [t.storeId])).resolves.toBeInstanceOf(Array);
  });
});
