import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntegrationController } from '../IntegrationController.js';

vi.mock('../../services/IntegrationService.js');

describe('IntegrationController', () => {
  let controller: IntegrationController;
  let mockService: any;
  let req: any;
  let res: any;

  const storeId = 'store-123';
  const integration = { id: 'int-1', store_id: storeId, name: 'iFood', type: 'ifood' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockService = {
      createIntegration: vi.fn(),
      getIntegration: vi.fn(),
      listIntegrations: vi.fn(),
      updateIntegration: vi.fn(),
      deleteIntegration: vi.fn(),
      createWebhook: vi.fn(),
      listWebhooks: vi.fn(),
      updateWebhook: vi.fn(),
      deleteWebhook: vi.fn(),
      listEvents: vi.fn(),
      testWebhook: vi.fn(),
      retryEvent: vi.fn(),
    };
    controller = new IntegrationController();
    (controller as any).integrationService = mockService;
    req = { user: { store_id: storeId }, body: {}, params: {}, query: {} };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  });

  describe('integrations', () => {
    it('should create (201)', async () => {
      req.body = { name: 'iFood', type: 'ifood' };
      mockService.createIntegration.mockResolvedValue(integration);
      await controller.createIntegration(req, res);
      expect(mockService.createIntegration).toHaveBeenCalledWith(storeId, req.body);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 without name/type', async () => {
      req.body = { name: 'iFood' };
      await controller.createIntegration(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockService.createIntegration).not.toHaveBeenCalled();
    });

    it('should return 400 on duplicate type', async () => {
      req.body = { name: 'iFood', type: 'ifood' };
      mockService.createIntegration.mockRejectedValue(new Error('Integration of this type already exists in this store'));
      await controller.createIntegration(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should get, 404 when missing', async () => {
      req.params = { id: 'int-1' };
      mockService.getIntegration.mockResolvedValue(integration);
      await controller.getIntegration(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: integration });

      mockService.getIntegration.mockRejectedValue(new Error('Integration not found'));
      await controller.getIntegration(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should list with pagination', async () => {
      req.query = { page: '2', limit: '5' };
      mockService.listIntegrations.mockResolvedValue({ data: [integration], pagination: { page: 2, limit: 5, total: 1, total_pages: 1 } });
      await controller.listIntegrations(req, res);
      expect(mockService.listIntegrations).toHaveBeenCalledWith(storeId, { page: 2, limit: 5 });
    });

    it('should update and delete', async () => {
      req.params = { id: 'int-1' };
      req.body = { status: 'active' };
      mockService.updateIntegration.mockResolvedValue(integration);
      await controller.updateIntegration(req, res);
      expect(mockService.updateIntegration).toHaveBeenCalledWith('int-1', storeId, req.body);

      await controller.deleteIntegration(req, res);
      expect(mockService.deleteIntegration).toHaveBeenCalledWith('int-1', storeId);
    });
  });

  describe('webhooks', () => {
    beforeEach(() => {
      req.params = { id: 'int-1', webhookId: 'wh-1' };
    });

    it('should create a webhook (201)', async () => {
      req.body = { event_type: 'order.created', endpoint_url: 'https://x.com' };
      mockService.createWebhook.mockResolvedValue({ id: 'wh-1' });
      await controller.createWebhook(req, res);
      expect(mockService.createWebhook).toHaveBeenCalledWith('int-1', storeId, req.body);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 without event_type/endpoint_url', async () => {
      req.body = { event_type: 'order.created' };
      await controller.createWebhook(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should list, update and delete webhooks', async () => {
      mockService.listWebhooks.mockResolvedValue([{ id: 'wh-1' }]);
      await controller.listWebhooks(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ id: 'wh-1' }] });

      req.body = { active: false };
      mockService.updateWebhook.mockResolvedValue({ id: 'wh-1' });
      await controller.updateWebhook(req, res);
      expect(mockService.updateWebhook).toHaveBeenCalledWith('wh-1', 'int-1', storeId, req.body);

      await controller.deleteWebhook(req, res);
      expect(mockService.deleteWebhook).toHaveBeenCalledWith('wh-1', 'int-1', storeId);
    });

    it('should return 404 when the integration is not found', async () => {
      mockService.listWebhooks.mockRejectedValue(new Error('Integration not found'));
      await controller.listWebhooks(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('test / retry', () => {
    it('should queue a test event (202)', async () => {
      req.params = { id: 'int-1', webhookId: 'wh-1' };
      mockService.testWebhook.mockResolvedValue({ id: 'e1' });
      await controller.testWebhook(req, res);
      expect(mockService.testWebhook).toHaveBeenCalledWith('wh-1', 'int-1', storeId);
      expect(res.status).toHaveBeenCalledWith(202);
    });

    it('should queue a retry (202) and map errors', async () => {
      req.params = { id: 'int-1', eventId: 'e1' };
      mockService.retryEvent.mockResolvedValue({ id: 'e1' });
      await controller.retryEvent(req, res);
      expect(mockService.retryEvent).toHaveBeenCalledWith('e1', 'int-1', storeId);
      expect(res.status).toHaveBeenCalledWith(202);

      mockService.retryEvent.mockRejectedValue(new Error('Webhook event not found'));
      await controller.retryEvent(req, res);
      expect(res.status).toHaveBeenCalledWith(404);

      mockService.retryEvent.mockRejectedValue(new Error('Only failed or skipped events can be retried'));
      await controller.retryEvent(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('events', () => {
    it('should list events', async () => {
      req.params = { id: 'int-1' };
      mockService.listEvents.mockResolvedValue({ data: [], pagination: { page: 1, limit: 10, total: 0, total_pages: 0 } });
      await controller.listEvents(req, res);
      expect(mockService.listEvents).toHaveBeenCalledWith('int-1', storeId, { page: 1, limit: 10 });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
});
