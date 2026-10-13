import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { createDataSource } from '../database/connection.js';
import { IntegrationModel } from '../database/models/IntegrationModel.js';
import { WebhookModel } from '../database/models/WebhookModel.js';
import { WebhookEventModel } from '../database/models/WebhookEventModel.js';
import { IntegrationQueries } from '../database/queries/IntegrationQueries.js';
import { WebhookDispatcher, WEBHOOK_EVENT_TYPES, validateEndpointUrl } from './WebhookDispatcher.js';
import {
  CreateIntegrationRequest,
  UpdateIntegrationRequest,
  IntegrationResponse,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  WebhookResponse,
  WebhookEventResponse,
  PaginatedResponse,
  PaginationQuery,
} from '../types/index.js';

const INTEGRATION_TYPES = ['ifood', 'aiqfome', 'custom'];
const INTEGRATION_STATUSES = ['active', 'inactive', 'error'];

const MAX_SECRET_LENGTH = 250;

const generateToken = (): string => randomBytes(24).toString('hex');

export class IntegrationService {
  private queries?: IntegrationQueries;
  private dispatcher = new WebhookDispatcher();

  private async ensureQueries(): Promise<IntegrationQueries> {
    if (!this.queries) {
      const ds = await createDataSource();
      const integrationRepo: Repository<IntegrationModel> = ds.getRepository(IntegrationModel);
      const webhookRepo: Repository<WebhookModel> = ds.getRepository(WebhookModel);
      const eventRepo: Repository<WebhookEventModel> = ds.getRepository(WebhookEventModel);
      this.queries = new IntegrationQueries(integrationRepo, webhookRepo, eventRepo);
    }
    return this.queries;
  }

  // ==================== Integrations ====================

  async createIntegration(storeId: string, data: CreateIntegrationRequest): Promise<IntegrationResponse> {
    const q = await this.ensureQueries();

    if (!INTEGRATION_TYPES.includes(data.type)) {
      throw new Error(`type must be one of: ${INTEGRATION_TYPES.join(', ')}`);
    }

    this.validateSecrets(data);

    const existing = await q.findIntegrationByType(data.type, storeId);
    if (existing) throw new Error('Integration of this type already exists in this store');

    const integration = await q.createIntegration({
      store_id: storeId,
      name: data.name,
      type: data.type,
      api_key: data.api_key,
      api_secret: data.api_secret,
      webhook_url: data.webhook_url,
      webhook_token: generateToken(),
      config: data.config,
      status: 'inactive',
      active: true,
    });
    return this.mapIntegration(integration);
  }

  async getIntegration(id: string, storeId: string): Promise<IntegrationResponse> {
    const q = await this.ensureQueries();
    const integration = await q.findIntegrationById(id, storeId);
    if (!integration) throw new Error('Integration not found');
    return this.mapIntegration(integration);
  }

  async listIntegrations(
    storeId: string,
    query: PaginationQuery
  ): Promise<PaginatedResponse<IntegrationResponse>> {
    const q = await this.ensureQueries();
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const [integrations, total] = await q.findAllByStore(storeId, skip, limit);
    return {
      data: integrations.map((i) => this.mapIntegration(i)),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  async updateIntegration(
    id: string,
    storeId: string,
    data: UpdateIntegrationRequest
  ): Promise<IntegrationResponse> {
    const q = await this.ensureQueries();
    const existing = await q.findIntegrationById(id, storeId);
    if (!existing) throw new Error('Integration not found');

    if (data.status !== undefined && !INTEGRATION_STATUSES.includes(data.status)) {
      throw new Error(`status must be one of: ${INTEGRATION_STATUSES.join(', ')}`);
    }
    this.validateSecrets(data);

    // type is immutable; only the allowed fields are copied
    const updateData: Partial<IntegrationModel> = { updated_at: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.api_key !== undefined) updateData.api_key = data.api_key;
    if (data.api_secret !== undefined) updateData.api_secret = data.api_secret;
    if (data.webhook_url !== undefined) updateData.webhook_url = data.webhook_url;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.config !== undefined) updateData.config = data.config;
    if (data.active !== undefined) updateData.active = data.active;

    const updated = await q.updateIntegration(id, storeId, updateData);
    return this.mapIntegration(updated!);
  }

  async deleteIntegration(id: string, storeId: string): Promise<void> {
    const q = await this.ensureQueries();
    const existing = await q.findIntegrationById(id, storeId);
    if (!existing) throw new Error('Integration not found');
    await q.deleteIntegration(id, storeId);
  }

  // ==================== Webhooks ====================

  async createWebhook(
    integrationId: string,
    storeId: string,
    data: CreateWebhookRequest
  ): Promise<WebhookResponse> {
    const q = await this.ensureQueries();
    await this.requireIntegration(q, integrationId, storeId);
    this.validateWebhookFields(data);

    const webhook = await q.createWebhook({
      integration_id: integrationId,
      event_type: data.event_type,
      endpoint_url: data.endpoint_url,
      webhook_token: generateToken(),
      max_retries: data.max_retries ?? 5,
      active: true,
    });
    return this.mapWebhook(webhook);
  }

  async listWebhooks(integrationId: string, storeId: string): Promise<WebhookResponse[]> {
    const q = await this.ensureQueries();
    await this.requireIntegration(q, integrationId, storeId);
    const webhooks = await q.findWebhooksByIntegration(integrationId);
    return webhooks.map((w) => this.mapWebhook(w));
  }

  async updateWebhook(
    id: string,
    integrationId: string,
    storeId: string,
    data: UpdateWebhookRequest
  ): Promise<WebhookResponse> {
    const q = await this.ensureQueries();
    await this.requireIntegration(q, integrationId, storeId);

    const existing = await q.findWebhookById(id, integrationId);
    if (!existing) throw new Error('Webhook not found');
    this.validateWebhookFields(data);

    const updateData: Partial<WebhookModel> = { updated_at: new Date() };
    if (data.event_type !== undefined) updateData.event_type = data.event_type;
    if (data.endpoint_url !== undefined) updateData.endpoint_url = data.endpoint_url;
    if (data.max_retries !== undefined) updateData.max_retries = data.max_retries;
    if (data.active !== undefined) updateData.active = data.active;

    const updated = await q.updateWebhook(id, integrationId, updateData);
    return this.mapWebhook(updated!);
  }

  async deleteWebhook(id: string, integrationId: string, storeId: string): Promise<void> {
    const q = await this.ensureQueries();
    await this.requireIntegration(q, integrationId, storeId);

    const existing = await q.findWebhookById(id, integrationId);
    if (!existing) throw new Error('Webhook not found');
    await q.deleteWebhook(id, integrationId);
  }

  /** Queues a webhook.test ping so the user can check the destination. */
  async testWebhook(id: string, integrationId: string, storeId: string): Promise<WebhookEventResponse> {
    const q = await this.ensureQueries();
    await this.requireIntegration(q, integrationId, storeId);

    const webhook = await q.findWebhookById(id, integrationId);
    if (!webhook) throw new Error('Webhook not found');

    const event = await this.dispatcher.enqueueTest(webhook);
    return this.mapEvent(event);
  }

  // ==================== Webhook events ====================

  async listEvents(
    integrationId: string,
    storeId: string,
    query: PaginationQuery
  ): Promise<PaginatedResponse<WebhookEventResponse>> {
    const q = await this.ensureQueries();
    await this.requireIntegration(q, integrationId, storeId);

    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const [events, total] = await q.findEventsByIntegration(integrationId, skip, limit);
    return {
      data: events.map((e) => this.mapEvent(e)),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  /** Puts a failed/skipped event back in the queue with a fresh attempt counter. */
  async retryEvent(eventId: string, integrationId: string, storeId: string): Promise<WebhookEventResponse> {
    const q = await this.ensureQueries();
    await this.requireIntegration(q, integrationId, storeId);

    const event = await q.findEventById(eventId, integrationId);
    if (!event) throw new Error('Webhook event not found');
    if (event.status !== 'failed' && event.status !== 'skipped') {
      throw new Error('Only failed or skipped events can be retried');
    }

    const reset = await q.resetEvent(eventId);
    return this.mapEvent(reset!);
  }

  // ==================== Helpers ====================

  // The encrypted form must fit in varchar(500)
  private validateSecrets(data: { api_key?: string; api_secret?: string }): void {
    for (const [field, value] of [['api_key', data.api_key], ['api_secret', data.api_secret]] as const) {
      if (value !== undefined && value.length > MAX_SECRET_LENGTH) {
        throw new Error(`${field} must have at most ${MAX_SECRET_LENGTH} characters`);
      }
    }
  }

  private validateWebhookFields(data: { event_type?: string; endpoint_url?: string; max_retries?: number }): void {
    if (data.event_type !== undefined && !(WEBHOOK_EVENT_TYPES as readonly string[]).includes(data.event_type)) {
      throw new Error(`event_type must be one of: ${WEBHOOK_EVENT_TYPES.join(', ')}`);
    }
    if (data.endpoint_url !== undefined) validateEndpointUrl(data.endpoint_url);
    if (data.max_retries !== undefined && (!Number.isInteger(data.max_retries) || data.max_retries < 1 || data.max_retries > 10)) {
      throw new Error('max_retries must be an integer between 1 and 10');
    }
  }

  private async requireIntegration(q: IntegrationQueries, integrationId: string, storeId: string): Promise<void> {
    const integration = await q.findIntegrationById(integrationId, storeId);
    if (!integration) throw new Error('Integration not found');
  }

  private mapIntegration(i: IntegrationModel): IntegrationResponse {
    return {
      id: i.id,
      store_id: i.store_id,
      name: i.name,
      type: i.type,
      has_api_key: !!i.api_key,
      has_api_secret: !!i.api_secret,
      webhook_url: i.webhook_url,
      status: i.status,
      last_sync: i.last_sync,
      last_error: i.last_error,
      config: i.config,
      active: i.active,
      created_at: i.created_at,
      updated_at: i.updated_at,
    };
  }

  private mapWebhook(w: WebhookModel): WebhookResponse {
    return {
      id: w.id,
      integration_id: w.integration_id,
      event_type: w.event_type,
      endpoint_url: w.endpoint_url,
      webhook_token: w.webhook_token,
      active: w.active,
      retry_count: w.retry_count,
      max_retries: w.max_retries,
      created_at: w.created_at,
      updated_at: w.updated_at,
    };
  }

  private mapEvent(e: WebhookEventModel): WebhookEventResponse {
    return {
      id: e.id,
      webhook_id: e.webhook_id,
      event_type: e.event_type,
      payload: e.payload,
      response_status: e.response_status,
      response_body: e.response_body,
      status: e.status,
      attempt_count: e.attempt_count,
      last_attempt: e.last_attempt,
      next_retry: e.next_retry,
      created_at: e.created_at,
    };
  }
}
