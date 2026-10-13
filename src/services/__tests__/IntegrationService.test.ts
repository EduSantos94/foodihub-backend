import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntegrationService } from '../IntegrationService.js';

vi.mock('../../database/connection.js', () => ({ createDataSource: vi.fn() }));

describe('IntegrationService', () => {
  let service: IntegrationService;
  let mockQueries: any;
  let mockDispatcher: any;

  const storeId = 'store-123';
  const integrationId = 'int-1';

  const integration = {
    id: integrationId,
    store_id: storeId,
    name: 'iFood',
    type: 'ifood',
    api_key: 'secret-key',
    api_secret: 'secret-secret',
    webhook_token: 'tok',
    status: 'inactive',
    active: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const webhook = {
    id: 'wh-1',
    integration_id: integrationId,
    event_type: 'order.created',
    endpoint_url: 'https://example.com/hook',
    webhook_token: 'whtok',
    active: true,
    retry_count: 0,
    max_retries: 5,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IntegrationService();
    mockQueries = {
      createIntegration: vi.fn(),
      findIntegrationById: vi.fn(),
      findIntegrationByType: vi.fn(),
      findAllByStore: vi.fn(),
      updateIntegration: vi.fn(),
      deleteIntegration: vi.fn(),
      createWebhook: vi.fn(),
      findWebhookById: vi.fn(),
      findWebhooksByIntegration: vi.fn(),
      updateWebhook: vi.fn(),
      deleteWebhook: vi.fn(),
      findEventsByIntegration: vi.fn(),
      findEventById: vi.fn(),
      resetEvent: vi.fn(),
    };
    mockDispatcher = { enqueueTest: vi.fn() };
    (service as any).queries = mockQueries;
    (service as any).dispatcher = mockDispatcher;
  });

  describe('createIntegration', () => {
    it('should create an integration with a generated webhook token and no secrets in the response', async () => {
      mockQueries.findIntegrationByType.mockResolvedValue(null);
      mockQueries.createIntegration.mockResolvedValue(integration);

      const result = await service.createIntegration(storeId, {
        name: 'iFood',
        type: 'ifood',
        api_key: 'secret-key',
        api_secret: 'secret-secret',
      });

      const created = mockQueries.createIntegration.mock.calls[0][0];
      expect(created.webhook_token).toMatch(/^[0-9a-f]{48}$/);
      expect(created).toMatchObject({ store_id: storeId, status: 'inactive', active: true });
      expect(result.has_api_key).toBe(true);
      expect(result.has_api_secret).toBe(true);
      expect(result).not.toHaveProperty('api_key');
      expect(result).not.toHaveProperty('api_secret');
      expect(result).not.toHaveProperty('webhook_token');
    });

    it('should reject an invalid type', async () => {
      await expect(service.createIntegration(storeId, { name: 'x', type: 'bogus' as any })).rejects.toThrow('type must be one of');
    });

    it('should reject secrets that would not fit once encrypted', async () => {
      await expect(
        service.createIntegration(storeId, { name: 'x', type: 'custom', api_key: 'a'.repeat(251) })
      ).rejects.toThrow('api_key must have at most 250');
    });

    it('should reject a duplicate type in the same store', async () => {
      mockQueries.findIntegrationByType.mockResolvedValue(integration);
      await expect(service.createIntegration(storeId, { name: 'iFood', type: 'ifood' })).rejects.toThrow('already exists');
    });
  });

  describe('get / list / update / delete', () => {
    it('should get an integration', async () => {
      mockQueries.findIntegrationById.mockResolvedValue(integration);
      const result = await service.getIntegration(integrationId, storeId);
      expect(result.id).toBe(integrationId);
    });

    it('should throw if not found', async () => {
      mockQueries.findIntegrationById.mockResolvedValue(null);
      await expect(service.getIntegration('x', storeId)).rejects.toThrow('Integration not found');
    });

    it('should list with pagination', async () => {
      mockQueries.findAllByStore.mockResolvedValue([[integration], 1]);
      const result = await service.listIntegrations(storeId, { page: 1, limit: 10 });
      expect(result.pagination.total).toBe(1);
      expect(result.data[0]).not.toHaveProperty('api_key');
    });

    it('should only copy allowed fields on update (type is immutable)', async () => {
      mockQueries.findIntegrationById.mockResolvedValue(integration);
      mockQueries.updateIntegration.mockResolvedValue({ ...integration, status: 'active' });

      await service.updateIntegration(integrationId, storeId, { status: 'active', type: 'custom', store_id: 'evil' } as any);

      const data = mockQueries.updateIntegration.mock.calls[0][2];
      expect(data.status).toBe('active');
      expect(data).not.toHaveProperty('type');
      expect(data).not.toHaveProperty('store_id');
    });

    it('should reject an invalid status', async () => {
      mockQueries.findIntegrationById.mockResolvedValue(integration);
      await expect(service.updateIntegration(integrationId, storeId, { status: 'bogus' as any })).rejects.toThrow('status must be one of');
    });

    it('should delete an integration', async () => {
      mockQueries.findIntegrationById.mockResolvedValue(integration);
      await service.deleteIntegration(integrationId, storeId);
      expect(mockQueries.deleteIntegration).toHaveBeenCalledWith(integrationId, storeId);
    });

    it('should throw on delete if not found', async () => {
      mockQueries.findIntegrationById.mockResolvedValue(null);
      await expect(service.deleteIntegration('x', storeId)).rejects.toThrow('Integration not found');
    });
  });

  describe('webhooks', () => {
    it('should create a webhook with a generated token and default retries', async () => {
      mockQueries.findIntegrationById.mockResolvedValue(integration);
      mockQueries.createWebhook.mockResolvedValue(webhook);

      await service.createWebhook(integrationId, storeId, { event_type: 'order.created', endpoint_url: 'https://example.com/hook' });

      const data = mockQueries.createWebhook.mock.calls[0][0];
      expect(data.webhook_token).toMatch(/^[0-9a-f]{48}$/);
      expect(data).toMatchObject({ integration_id: integrationId, max_retries: 5, active: true });
    });

    it('should not touch webhooks of an integration from another store', async () => {
      mockQueries.findIntegrationById.mockResolvedValue(null);
      await expect(service.listWebhooks(integrationId, 'other-store')).rejects.toThrow('Integration not found');
      await expect(service.createWebhook(integrationId, 'other-store', { event_type: 'a', endpoint_url: 'b' })).rejects.toThrow('Integration not found');
      expect(mockQueries.createWebhook).not.toHaveBeenCalled();
    });

    it('should list webhooks', async () => {
      mockQueries.findIntegrationById.mockResolvedValue(integration);
      mockQueries.findWebhooksByIntegration.mockResolvedValue([webhook]);
      const result = await service.listWebhooks(integrationId, storeId);
      expect(result).toHaveLength(1);
    });

    it('should update and delete a webhook', async () => {
      mockQueries.findIntegrationById.mockResolvedValue(integration);
      mockQueries.findWebhookById.mockResolvedValue(webhook);
      mockQueries.updateWebhook.mockResolvedValue({ ...webhook, active: false });

      const updated = await service.updateWebhook('wh-1', integrationId, storeId, { active: false });
      expect(updated.active).toBe(false);

      await service.deleteWebhook('wh-1', integrationId, storeId);
      expect(mockQueries.deleteWebhook).toHaveBeenCalledWith('wh-1', integrationId);
    });

    it('should throw if webhook not found', async () => {
      mockQueries.findIntegrationById.mockResolvedValue(integration);
      mockQueries.findWebhookById.mockResolvedValue(null);
      await expect(service.updateWebhook('x', integrationId, storeId, {})).rejects.toThrow('Webhook not found');
      await expect(service.deleteWebhook('x', integrationId, storeId)).rejects.toThrow('Webhook not found');
    });
  });

  describe('webhook validation', () => {
    beforeEach(() => mockQueries.findIntegrationById.mockResolvedValue(integration));

    it('should reject unknown event types', async () => {
      await expect(
        service.createWebhook(integrationId, storeId, { event_type: 'order.exploded', endpoint_url: 'https://example.com/h' })
      ).rejects.toThrow('event_type must be one of');
    });

    it('should reject non-http(s) and private destinations', async () => {
      for (const url of ['ftp://example.com/h', 'not a url', 'http://localhost:3000/h', 'http://127.0.0.1/h', 'http://192.168.1.10/h', 'http://169.254.169.254/latest', 'http://[::1]/h']) {
        await expect(
          service.createWebhook(integrationId, storeId, { event_type: 'order.created', endpoint_url: url })
        ).rejects.toThrow('endpoint_url');
      }
      expect(mockQueries.createWebhook).not.toHaveBeenCalled();
    });

    it('should validate on update too, and bound max_retries', async () => {
      mockQueries.findWebhookById.mockResolvedValue(webhook);
      await expect(service.updateWebhook('wh-1', integrationId, storeId, { endpoint_url: 'http://10.0.0.1/h' })).rejects.toThrow('private');
      await expect(service.updateWebhook('wh-1', integrationId, storeId, { max_retries: 99 })).rejects.toThrow('max_retries');
    });
  });

  describe('testWebhook', () => {
    it('should queue a test event', async () => {
      mockQueries.findIntegrationById.mockResolvedValue(integration);
      mockQueries.findWebhookById.mockResolvedValue(webhook);
      mockDispatcher.enqueueTest.mockResolvedValue({ id: 'e1', webhook_id: 'wh-1', event_type: 'webhook.test', payload: '{}', status: 'pending', attempt_count: 0, created_at: new Date() });

      const result = await service.testWebhook('wh-1', integrationId, storeId);

      expect(mockDispatcher.enqueueTest).toHaveBeenCalledWith(webhook);
      expect(result.event_type).toBe('webhook.test');
    });

    it('should throw if the webhook does not exist', async () => {
      mockQueries.findIntegrationById.mockResolvedValue(integration);
      mockQueries.findWebhookById.mockResolvedValue(null);
      await expect(service.testWebhook('x', integrationId, storeId)).rejects.toThrow('Webhook not found');
    });
  });

  describe('retryEvent', () => {
    const baseEvent = { id: 'e1', webhook_id: 'wh-1', event_type: 'order.created', payload: '{}', attempt_count: 5, created_at: new Date() };

    it('should reset a failed event', async () => {
      mockQueries.findIntegrationById.mockResolvedValue(integration);
      mockQueries.findEventById.mockResolvedValue({ ...baseEvent, status: 'failed' });
      mockQueries.resetEvent.mockResolvedValue({ ...baseEvent, status: 'pending', attempt_count: 0 });

      const result = await service.retryEvent('e1', integrationId, storeId);

      expect(mockQueries.resetEvent).toHaveBeenCalledWith('e1');
      expect(result.status).toBe('pending');
    });

    it('should refuse events that are not failed/skipped', async () => {
      mockQueries.findIntegrationById.mockResolvedValue(integration);
      mockQueries.findEventById.mockResolvedValue({ ...baseEvent, status: 'delivered' });
      await expect(service.retryEvent('e1', integrationId, storeId)).rejects.toThrow('Only failed or skipped');
      expect(mockQueries.resetEvent).not.toHaveBeenCalled();
    });

    it('should throw if the event is not in this integration', async () => {
      mockQueries.findIntegrationById.mockResolvedValue(integration);
      mockQueries.findEventById.mockResolvedValue(null);
      await expect(service.retryEvent('e1', integrationId, storeId)).rejects.toThrow('not found');
    });
  });

  describe('listEvents', () => {
    it('should list events with pagination', async () => {
      mockQueries.findIntegrationById.mockResolvedValue(integration);
      mockQueries.findEventsByIntegration.mockResolvedValue([[{ id: 'e1', webhook_id: 'wh-1', event_type: 'order.created', payload: '{}', status: 'pending', attempt_count: 0, created_at: new Date() }], 1]);

      const result = await service.listEvents(integrationId, storeId, { page: 1, limit: 10 });

      expect(mockQueries.findEventsByIntegration).toHaveBeenCalledWith(integrationId, 0, 10);
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });
  });
});
