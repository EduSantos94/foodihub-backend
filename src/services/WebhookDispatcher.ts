import { createHmac } from 'crypto';
import { isIP } from 'net';
import { Repository } from 'typeorm';
import { createDataSource } from '../database/connection.js';
import { WebhookModel } from '../database/models/WebhookModel.js';
import { WebhookEventModel } from '../database/models/WebhookEventModel.js';
import { WebhookQueries } from '../database/queries/WebhookQueries.js';

export const WEBHOOK_EVENT_TYPES = ['order.created', 'order.updated', 'order.cancelled', 'webhook.test'] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

// Minutes to wait before attempt N+1 (the last value is reused for any further attempt)
export const RETRY_BACKOFF_MINUTES = [5, 15, 60, 240, 720];

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BODY = 2000;

export function retryDelayMinutes(attemptCount: number): number {
  const index = Math.min(Math.max(attemptCount, 1) - 1, RETRY_BACKOFF_MINUTES.length - 1);
  return RETRY_BACKOFF_MINUTES[index];
}

/**
 * Validates a webhook destination. Only http(s) is accepted, and literal private/loopback
 * hosts are blocked (SSRF) unless WEBHOOK_ALLOW_PRIVATE=true (useful in development).
 * Note: hostnames are not resolved, so DNS rebinding is not covered.
 */
export function validateEndpointUrl(raw: string): void {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('endpoint_url must be a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('endpoint_url must use http or https');
  }
  if (process.env.WEBHOOK_ALLOW_PRIVATE === 'true') return;

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const privateV4 = /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
  const privateV6 = /^(::1?$|fc|fd|fe80)/;
  const blocked =
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    (isIP(host) === 4 && privateV4.test(host)) ||
    (isIP(host) === 6 && privateV6.test(host));
  if (blocked) throw new Error('endpoint_url must not point to a private or local address');
}

export class WebhookDispatcher {
  private queries?: WebhookQueries;

  private async ensureQueries(): Promise<WebhookQueries> {
    if (!this.queries) {
      const ds = await createDataSource();
      const webhookRepo: Repository<WebhookModel> = ds.getRepository(WebhookModel);
      const eventRepo: Repository<WebhookEventModel> = ds.getRepository(WebhookEventModel);
      this.queries = new WebhookQueries(webhookRepo, eventRepo);
    }
    return this.queries;
  }

  /** Queues one event per active webhook of the store that listens to eventType. */
  async enqueue(storeId: string, eventType: WebhookEventType, data: unknown): Promise<number> {
    const q = await this.ensureQueries();
    const webhooks = await q.findActiveWebhooksForEvent(storeId, eventType);
    const payload = JSON.stringify({ event: eventType, occurred_at: new Date().toISOString(), data });
    const created = await q.createEvents(
      webhooks.map((w) => ({
        webhook_id: w.id,
        event_type: eventType,
        payload,
        status: 'pending' as const,
      }))
    );
    return created.length;
  }

  /** Queues a test ping for one specific webhook. */
  async enqueueTest(webhook: WebhookModel): Promise<WebhookEventModel> {
    const q = await this.ensureQueries();
    const [event] = await q.createEvents([
      {
        webhook_id: webhook.id,
        event_type: 'webhook.test',
        payload: JSON.stringify({
          event: 'webhook.test',
          occurred_at: new Date().toISOString(),
          data: { message: 'FoodiHub webhook test' },
        }),
        status: 'pending',
      },
    ]);
    return event;
  }

  /** Removes old delivered/skipped (default 30 days) and failed (default 90 days) events. */
  async purgeOld(days = 30, failedDays = 90): Promise<number> {
    const q = await this.ensureQueries();
    return q.purgeOldEvents(days, failedDays);
  }

  /** Delivers every event that is due. Returns how many were processed. */
  async processDue(limit = 20): Promise<number> {
    const q = await this.ensureQueries();
    const events = await q.claimDueEvents(limit);
    await Promise.all(events.map((e) => this.deliver(q, e)));
    return events.length;
  }

  private async deliver(q: WebhookQueries, event: WebhookEventModel): Promise<void> {
    try {
      const target = await q.findWebhookTarget(event.webhook_id);
      if (!target || !target.webhook.active || !target.integration_active) {
        await q.updateEvent(event.id, { status: 'skipped', next_retry: null as any });
        return;
      }

      const { webhook } = target;
      let responseStatus: number | undefined;
      let responseBody: string | undefined;
      let delivered = false;

      try {
        validateEndpointUrl(webhook.endpoint_url);
        const signature = createHmac('sha256', webhook.webhook_token).update(event.payload).digest('hex');
        const response = await fetch(webhook.endpoint_url, {
          method: 'POST',
          redirect: 'manual',
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'FoodiHub-Webhook/1.0',
            'X-Webhook-Id': event.id,
            'X-Webhook-Event': event.event_type,
            'X-Webhook-Token': webhook.webhook_token,
            'X-Webhook-Signature': `sha256=${signature}`,
          },
          body: event.payload,
        });
        responseStatus = response.status;
        responseBody = (await response.text()).slice(0, MAX_RESPONSE_BODY);
        delivered = response.status >= 200 && response.status < 300;
      } catch (err: any) {
        responseBody = `request error: ${err?.message ?? 'unknown'}`.slice(0, MAX_RESPONSE_BODY);
      }

      if (delivered) {
        await q.updateEvent(event.id, {
          status: 'delivered',
          response_status: responseStatus,
          response_body: responseBody,
          next_retry: null as any,
        });
      } else if (event.attempt_count >= webhook.max_retries) {
        await q.updateEvent(event.id, {
          status: 'failed',
          response_status: responseStatus,
          response_body: responseBody,
          next_retry: null as any,
        });
      } else {
        await q.scheduleRetry(event.id, retryDelayMinutes(event.attempt_count), responseStatus, responseBody);
      }
    } catch (err) {
      console.error('Webhook delivery bookkeeping failed for event', event.id, err);
    }
  }
}
