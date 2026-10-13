import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'crypto';
import {
  WebhookDispatcher,
  retryDelayMinutes,
  validateEndpointUrl,
} from '../WebhookDispatcher.js';

vi.mock('../../database/connection.js', () => ({ createDataSource: vi.fn() }));

describe('retryDelayMinutes', () => {
  it('should back off 5, 15, 60, 240, 720 and then stay at 720', () => {
    expect([1, 2, 3, 4, 5, 6, 20].map(retryDelayMinutes)).toEqual([5, 15, 60, 240, 720, 720, 720]);
  });
});

describe('validateEndpointUrl', () => {
  afterEach(() => {
    delete process.env.WEBHOOK_ALLOW_PRIVATE;
  });

  it('should accept public http(s) urls', () => {
    expect(() => validateEndpointUrl('https://api.example.com/hook')).not.toThrow();
    expect(() => validateEndpointUrl('http://8.8.8.8/hook')).not.toThrow();
  });

  it('should reject invalid, non-http and private urls', () => {
    expect(() => validateEndpointUrl('nope')).toThrow('valid URL');
    expect(() => validateEndpointUrl('file:///etc/passwd')).toThrow('http or https');
    for (const u of ['http://localhost/x', 'http://a.localhost/x', 'http://10.1.2.3/x', 'http://172.16.0.1/x', 'http://172.31.255.1/x', 'http://[fd00::1]/x', 'http://metadata.internal/x']) {
      expect(() => validateEndpointUrl(u)).toThrow('private');
    }
  });

  it('should allow private hosts when WEBHOOK_ALLOW_PRIVATE=true', () => {
    process.env.WEBHOOK_ALLOW_PRIVATE = 'true';
    expect(() => validateEndpointUrl('http://localhost:4000/x')).not.toThrow();
  });
});

describe('WebhookDispatcher', () => {
  let dispatcher: WebhookDispatcher;
  let q: any;
  const fetchMock = vi.fn();

  const webhook = {
    id: 'wh-1',
    integration_id: 'int-1',
    event_type: 'order.created',
    endpoint_url: 'https://example.com/hook',
    webhook_token: 'secret-token',
    active: true,
    max_retries: 3,
  };

  const event = (over: any = {}) => ({
    id: 'e1',
    webhook_id: 'wh-1',
    event_type: 'order.created',
    payload: '{"event":"order.created"}',
    status: 'sent',
    attempt_count: 1,
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    dispatcher = new WebhookDispatcher();
    q = {
      findActiveWebhooksForEvent: vi.fn(),
      createEvents: vi.fn(async (e: any[]) => e),
      claimDueEvents: vi.fn(),
      findWebhookTarget: vi.fn(),
      updateEvent: vi.fn(),
      scheduleRetry: vi.fn(),
    };
    (dispatcher as any).queries = q;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('enqueue', () => {
    it('should create one pending event per matching webhook', async () => {
      q.findActiveWebhooksForEvent.mockResolvedValue([webhook, { ...webhook, id: 'wh-2' }]);

      const count = await dispatcher.enqueue('store-1', 'order.created', { id: 'sale-1' });

      expect(q.findActiveWebhooksForEvent).toHaveBeenCalledWith('store-1', 'order.created');
      const created = q.createEvents.mock.calls[0][0];
      expect(count).toBe(2);
      expect(created.map((e: any) => e.webhook_id)).toEqual(['wh-1', 'wh-2']);
      expect(created[0]).toMatchObject({ status: 'pending', event_type: 'order.created' });
      expect(JSON.parse(created[0].payload)).toMatchObject({ event: 'order.created', data: { id: 'sale-1' } });
    });

    it('should do nothing when no webhook listens', async () => {
      q.findActiveWebhooksForEvent.mockResolvedValue([]);
      expect(await dispatcher.enqueue('store-1', 'order.created', {})).toBe(0);
    });
  });

  describe('processDue', () => {
    it('should mark the event delivered on 2xx and sign the request', async () => {
      q.claimDueEvents.mockResolvedValue([event()]);
      q.findWebhookTarget.mockResolvedValue({ webhook, integration_active: true });
      fetchMock.mockResolvedValue({ status: 200, text: async () => 'ok' });

      const n = await dispatcher.processDue();

      expect(n).toBe(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://example.com/hook');
      expect(init.method).toBe('POST');
      expect(init.redirect).toBe('manual');
      expect(init.headers['X-Webhook-Token']).toBe('secret-token');
      expect(init.headers['X-Webhook-Signature']).toBe(
        'sha256=' + createHmac('sha256', 'secret-token').update('{"event":"order.created"}').digest('hex')
      );
      expect(q.updateEvent).toHaveBeenCalledWith('e1', expect.objectContaining({ status: 'delivered', response_status: 200 }));
    });

    it('should schedule a retry with backoff on a non-2xx response', async () => {
      q.claimDueEvents.mockResolvedValue([event({ attempt_count: 2 })]);
      q.findWebhookTarget.mockResolvedValue({ webhook, integration_active: true });
      fetchMock.mockResolvedValue({ status: 500, text: async () => 'boom' });

      await dispatcher.processDue();

      // attempt 2 -> 15 minutes, computed by the database
      expect(q.scheduleRetry).toHaveBeenCalledWith('e1', 15, 500, 'boom');
      expect(q.updateEvent).not.toHaveBeenCalled();
    });

    it('should treat redirects as failures', async () => {
      q.claimDueEvents.mockResolvedValue([event()]);
      q.findWebhookTarget.mockResolvedValue({ webhook, integration_active: true });
      fetchMock.mockResolvedValue({ status: 302, text: async () => '' });

      await dispatcher.processDue();

      expect(q.scheduleRetry).toHaveBeenCalledWith('e1', 5, 302, '');
    });

    it('should retry on network errors and record the message', async () => {
      q.claimDueEvents.mockResolvedValue([event()]);
      q.findWebhookTarget.mockResolvedValue({ webhook, integration_active: true });
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

      await dispatcher.processDue();

      expect(q.scheduleRetry).toHaveBeenCalledWith('e1', 5, undefined, expect.stringContaining('ECONNREFUSED'));
    });

    it('should give up as failed once max_retries attempts were made', async () => {
      q.claimDueEvents.mockResolvedValue([event({ attempt_count: 3 })]);
      q.findWebhookTarget.mockResolvedValue({ webhook, integration_active: true });
      fetchMock.mockResolvedValue({ status: 503, text: async () => '' });

      await dispatcher.processDue();

      expect(q.updateEvent).toHaveBeenCalledWith('e1', expect.objectContaining({ status: 'failed', next_retry: null }));
    });

    it('should skip events whose webhook or integration is inactive or gone', async () => {
      q.claimDueEvents.mockResolvedValue([event(), event({ id: 'e2' }), event({ id: 'e3' })]);
      q.findWebhookTarget
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ webhook: { ...webhook, active: false }, integration_active: true })
        .mockResolvedValueOnce({ webhook, integration_active: false });

      await dispatcher.processDue();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(q.updateEvent.mock.calls.map((c: any[]) => c[1].status)).toEqual(['skipped', 'skipped', 'skipped']);
    });

    it('should not call a destination that became private', async () => {
      q.claimDueEvents.mockResolvedValue([event()]);
      q.findWebhookTarget.mockResolvedValue({ webhook: { ...webhook, endpoint_url: 'http://127.0.0.1/x' }, integration_active: true });

      await dispatcher.processDue();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(q.scheduleRetry).toHaveBeenCalledWith('e1', 5, undefined, expect.stringContaining('private'));
    });

    it('should return 0 when nothing is due', async () => {
      q.claimDueEvents.mockResolvedValue([]);
      expect(await dispatcher.processDue()).toBe(0);
    });
  });
});
