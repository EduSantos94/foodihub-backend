import { Repository } from 'typeorm';
import { IntegrationModel } from '../models/IntegrationModel.js';
import { WebhookModel } from '../models/WebhookModel.js';
import { WebhookEventModel } from '../models/WebhookEventModel.js';

export class IntegrationQueries {
  constructor(
    private integrationRepository: Repository<IntegrationModel>,
    private webhookRepository: Repository<WebhookModel>,
    private eventRepository: Repository<WebhookEventModel>
  ) {}

  // ==================== Integrations ====================

  async createIntegration(data: Partial<IntegrationModel>): Promise<IntegrationModel> {
    const integration = this.integrationRepository.create(data);
    return this.integrationRepository.save(integration);
  }

  async findIntegrationById(id: string, storeId: string): Promise<IntegrationModel | null> {
    return this.integrationRepository.findOne({ where: { id, store_id: storeId } });
  }

  async findIntegrationByType(type: string, storeId: string): Promise<IntegrationModel | null> {
    return this.integrationRepository.findOne({ where: { type: type as any, store_id: storeId } });
  }

  async findAllByStore(storeId: string, skip = 0, take = 10): Promise<[IntegrationModel[], number]> {
    return this.integrationRepository.findAndCount({
      where: { store_id: storeId },
      order: { name: 'ASC' },
      skip,
      take,
    });
  }

  async updateIntegration(
    id: string,
    storeId: string,
    data: Partial<IntegrationModel>
  ): Promise<IntegrationModel | null> {
    await this.integrationRepository.update({ id, store_id: storeId }, data);
    return this.findIntegrationById(id, storeId);
  }

  async deleteIntegration(id: string, storeId: string): Promise<boolean> {
    const result = await this.integrationRepository.delete({ id, store_id: storeId });
    return (result.affected || 0) > 0;
  }

  // ==================== Webhooks (always reached through an integration of the store) ====================

  async createWebhook(data: Partial<WebhookModel>): Promise<WebhookModel> {
    const webhook = this.webhookRepository.create(data);
    return this.webhookRepository.save(webhook);
  }

  async findWebhookById(id: string, integrationId: string): Promise<WebhookModel | null> {
    return this.webhookRepository.findOne({ where: { id, integration_id: integrationId } });
  }

  async findWebhooksByIntegration(integrationId: string): Promise<WebhookModel[]> {
    return this.webhookRepository.find({
      where: { integration_id: integrationId },
      order: { created_at: 'ASC' },
    });
  }

  async updateWebhook(id: string, integrationId: string, data: Partial<WebhookModel>): Promise<WebhookModel | null> {
    await this.webhookRepository.update({ id, integration_id: integrationId }, data);
    return this.findWebhookById(id, integrationId);
  }

  async deleteWebhook(id: string, integrationId: string): Promise<boolean> {
    const result = await this.webhookRepository.delete({ id, integration_id: integrationId });
    return (result.affected || 0) > 0;
  }

  // ==================== Webhook events (read-only log) ====================

  async findEventById(eventId: string, integrationId: string): Promise<WebhookEventModel | null> {
    return this.eventRepository
      .createQueryBuilder('e')
      .innerJoin(WebhookModel, 'w', 'w.id = e.webhook_id')
      .where('e.id = :eventId', { eventId })
      .andWhere('w.integration_id = :integrationId', { integrationId })
      .getOne();
  }

  async resetEvent(eventId: string): Promise<WebhookEventModel | null> {
    await this.eventRepository.update(
      { id: eventId },
      { status: 'pending', attempt_count: 0, next_retry: null as any }
    );
    return this.eventRepository.findOne({ where: { id: eventId } });
  }

  async findEventsByIntegration(
    integrationId: string,
    skip = 0,
    take = 10
  ): Promise<[WebhookEventModel[], number]> {
    const qb = this.eventRepository
      .createQueryBuilder('e')
      .innerJoin(WebhookModel, 'w', 'w.id = e.webhook_id')
      .where('w.integration_id = :integrationId', { integrationId })
      .orderBy('e.created_at', 'DESC')
      .skip(skip)
      .take(take);
    return qb.getManyAndCount();
  }
}
