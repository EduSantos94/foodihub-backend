/**
 * Generic HTTP layer for the aiqfome API. It knows nothing about specific endpoints yet: the contract is
 * still being verified (see docs/integrations/AIQFOME.md), so endpoint methods are added only once confirmed.
 *
 * Security notes:
 * - `baseUrl` must come from server configuration (env), NEVER from a store-editable field such as
 *   integrations.config, otherwise a store admin could point the server at internal addresses (SSRF).
 * - The token is never logged and never appears in error messages.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class AiqfomeApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryable: boolean,
    public readonly body?: string
  ) {
    super(message);
    this.name = 'AiqfomeApiError';
  }
}

/** 401/403 that persisted after a token refresh (or when no refresh is available). Not retryable. */
export class AiqfomeAuthError extends AiqfomeApiError {
  constructor(status: number, body?: string) {
    super(`aiqfome rejected the credentials (HTTP ${status})`, status, false, body);
    this.name = 'AiqfomeAuthError';
  }
}

/** Timeout or connection failure: no HTTP response was received. */
export class AiqfomeNetworkError extends Error {
  readonly retryable = true;
  constructor(message: string) {
    super(message);
    this.name = 'AiqfomeNetworkError';
  }
}

export interface AiqfomeClientOptions {
  baseUrl: string;
  getToken: () => Promise<string>;
  /** Called once on a 401 to get a fresh token; the request is then retried a single time. */
  refreshToken?: () => Promise<string>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  maxRetryAfterMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
// Methods that are safe to repeat after a 5xx or a lost connection. For the others only 429 is retried,
// because a 429 means the request was not processed.
const IDEMPOTENT: ReadonlySet<HttpMethod> = new Set(['GET', 'PUT', 'DELETE']);
const MAX_ERROR_BODY = 500;

export function parseRetryAfterMs(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

export class AiqfomeClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly maxRetryAfterMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly options: AiqfomeClientOptions) {
    let url: URL;
    try {
      url = new URL(options.baseUrl);
    } catch {
      throw new Error('aiqfome baseUrl must be a valid URL');
    }
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && process.env.NODE_ENV !== 'production')) {
      throw new Error('aiqfome baseUrl must use https');
    }
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxRetries = options.maxRetries ?? 3;
    this.maxRetryAfterMs = options.maxRetryAfterMs ?? 60_000;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  get<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    return this.request<T>('GET', path, opts);
  }
  post<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    return this.request<T>('POST', path, opts);
  }
  put<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    return this.request<T>('PUT', path, opts);
  }
  delete<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    return this.request<T>('DELETE', path, opts);
  }

  async request<T>(method: HttpMethod, path: string, opts: RequestOptions = {}): Promise<T> {
    if (!path.startsWith('/')) throw new Error('aiqfome path must start with /');
    const url = this.buildUrl(path, opts.query);

    let token = await this.options.getToken();
    let refreshed = false;
    let attempt = 0;

    for (;;) {
      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          method,
          redirect: 'manual',
          signal: AbortSignal.timeout(this.timeoutMs),
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
            ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        });
      } catch (err) {
        const error = new AiqfomeNetworkError(this.redact(err instanceof Error ? err.message : 'request failed', token));
        if (IDEMPOTENT.has(method) && attempt < this.maxRetries) {
          await this.sleep(this.backoffMs(attempt++));
          continue;
        }
        throw error;
      }

      if (response.ok) return (await this.parseBody(response)) as T;

      const bodyText = this.redact((await response.text().catch(() => '')).slice(0, MAX_ERROR_BODY), token);

      if (response.status === 401 && this.options.refreshToken && !refreshed) {
        refreshed = true;
        token = await this.options.refreshToken();
        continue;
      }
      if (response.status === 401 || response.status === 403) throw new AiqfomeAuthError(response.status, bodyText);

      const retryable = RETRYABLE_STATUS.has(response.status) && (response.status === 429 || IDEMPOTENT.has(method));
      if (retryable && attempt < this.maxRetries) {
        const retryAfter = parseRetryAfterMs(response.headers.get('retry-after'));
        const wait = retryAfter !== undefined ? Math.min(retryAfter, this.maxRetryAfterMs) : this.backoffMs(attempt);
        attempt++;
        await this.sleep(wait);
        continue;
      }

      throw new AiqfomeApiError(
        `aiqfome request failed: ${method} ${path} -> HTTP ${response.status}`,
        response.status,
        RETRYABLE_STATUS.has(response.status),
        bodyText
      );
    }
  }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  /** 500ms, 1s, 2s, 4s... capped at 8s, plus up to 20% jitter. */
  private backoffMs(attempt: number): number {
    const base = Math.min(500 * 2 ** attempt, 8_000);
    return Math.round(base * (1 + Math.random() * 0.2));
  }

  private async parseBody(response: Response): Promise<unknown> {
    if (response.status === 204) return undefined;
    const text = await response.text();
    if (!text) return undefined;
    const type = response.headers.get('content-type') ?? '';
    if (type.includes('json')) {
      try {
        return JSON.parse(text);
      } catch {
        throw new AiqfomeApiError('aiqfome returned invalid JSON', response.status, false);
      }
    }
    return text;
  }

  private redact(text: string, token: string): string {
    return token ? text.split(token).join('[redacted]') : text;
  }
}
