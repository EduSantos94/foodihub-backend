import { Request, Response } from 'express';
import { IntegrationService } from '../services/IntegrationService.js';
import {
  CreateIntegrationRequest,
  UpdateIntegrationRequest,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  PaginationQuery,
} from '../types/index.js';

export class IntegrationController {
  private integrationService: IntegrationService;

  constructor() {
    this.integrationService = new IntegrationService();
  }

  // ==================== Integrations ====================

  async createIntegration(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const data: CreateIntegrationRequest = req.body;

      if (!data.name || !data.type) {
        this.badRequest(res, 'name and type are required');
        return;
      }

      const integration = await this.integrationService.createIntegration(storeId, data);
      res.status(201).json({ success: true, data: integration, message: 'Integration created successfully' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getIntegration(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const integration = await this.integrationService.getIntegration(req.params.id, storeId);
      res.json({ success: true, data: integration });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async listIntegrations(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const result = await this.integrationService.listIntegrations(storeId, this.pagination(req));
      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async updateIntegration(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const data: UpdateIntegrationRequest = req.body;
      const integration = await this.integrationService.updateIntegration(req.params.id, storeId, data);
      res.json({ success: true, data: integration, message: 'Integration updated successfully' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async deleteIntegration(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      await this.integrationService.deleteIntegration(req.params.id, storeId);
      res.json({ success: true, message: 'Integration deleted successfully' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ==================== Webhooks ====================

  async createWebhook(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const data: CreateWebhookRequest = req.body;

      if (!data.event_type || !data.endpoint_url) {
        this.badRequest(res, 'event_type and endpoint_url are required');
        return;
      }

      const webhook = await this.integrationService.createWebhook(req.params.id, storeId, data);
      res.status(201).json({ success: true, data: webhook, message: 'Webhook created successfully' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async listWebhooks(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const webhooks = await this.integrationService.listWebhooks(req.params.id, storeId);
      res.json({ success: true, data: webhooks });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async updateWebhook(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const data: UpdateWebhookRequest = req.body;
      const webhook = await this.integrationService.updateWebhook(
        req.params.webhookId,
        req.params.id,
        storeId,
        data
      );
      res.json({ success: true, data: webhook, message: 'Webhook updated successfully' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async deleteWebhook(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      await this.integrationService.deleteWebhook(req.params.webhookId, req.params.id, storeId);
      res.json({ success: true, message: 'Webhook deleted successfully' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async testWebhook(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const event = await this.integrationService.testWebhook(req.params.webhookId, req.params.id, storeId);
      res.status(202).json({ success: true, data: event, message: 'Test event queued' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ==================== Webhook events ====================

  async listEvents(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const result = await this.integrationService.listEvents(req.params.id, storeId, this.pagination(req));
      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async retryEvent(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const event = await this.integrationService.retryEvent(req.params.eventId, req.params.id, storeId);
      res.status(202).json({ success: true, data: event, message: 'Event queued for retry' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ==================== Helpers ====================

  private pagination(req: Request): PaginationQuery {
    return {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
    };
  }

  private badRequest(res: Response, error: string): void {
    res.status(400).json({ success: false, error, status_code: 400, timestamp: new Date() });
  }

  private handleError(error: any, res: Response): void {
    const message = error.message || 'Internal server error';
    const status = message.includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, error: message, status_code: status, timestamp: new Date() });
  }
}
