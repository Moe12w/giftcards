import { unwrapEnvelope } from './errors';
import type {
  CaptureData,
  CaptureRequest,
  GiftCardTransport,
  PreviewData,
  PreviewRequest,
  ReleaseData,
  ReleaseRequest,
  ReserveData,
  ReserveRequest,
  StatusData,
  ValidateData,
  ValidateRequest,
} from './types';

/**
 * Default transport: calls the HOST PLATFORM'S backend, not Tazella directly.
 *
 * The host backend owns the Tazella API credential and signs requests. This
 * class never sees a secret. Each path below is relative to `hostBaseUrl` and
 * must be implemented by the host (see examples/node-server.ts).
 */
export interface FetchTransportOptions {
  hostBaseUrl: string;
  fetch?: typeof fetch;
  headers?: Record<string, string> | (() => Record<string, string>);
  apiVersion?: string;
}

export class FetchTransport implements GiftCardTransport {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly headers: Record<string, string> | (() => Record<string, string>);
  private readonly apiVersion: string;

  constructor(options: FetchTransportOptions) {
    this.baseUrl = options.hostBaseUrl.replace(/\/$/, '');
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.headers = options.headers ?? {};
    this.apiVersion = options.apiVersion ?? 'v1';
  }

  private async post<T>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
    if (typeof this.fetchImpl !== 'function') {
      throw new Error('fetch is not available; provide a fetch implementation');
    }

    const baseHeaders = typeof this.headers === 'function' ? this.headers() : this.headers;
    const response = await this.fetchImpl(`${this.baseUrl}/${this.apiVersion}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...baseHeaders,
        ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
    });

    const payload: unknown = await response.json();
    return unwrapEnvelope<T>(payload, response.status);
  }

  private async get<T>(path: string): Promise<T> {
    if (typeof this.fetchImpl !== 'function') {
      throw new Error('fetch is not available; provide a fetch implementation');
    }

    const baseHeaders = typeof this.headers === 'function' ? this.headers() : this.headers;
    const response = await this.fetchImpl(`${this.baseUrl}/${this.apiVersion}${path}`, {
      method: 'GET',
      headers: { Accept: 'application/json', ...baseHeaders },
    });

    const payload: unknown = await response.json();
    return unwrapEnvelope<T>(payload, response.status);
  }

  validate(request: ValidateRequest) {
    return this.post<ValidateData>('/gift-cards/validate', request);
  }

  preview(request: PreviewRequest) {
    return this.post<PreviewData>('/gift-cards/preview', request);
  }

  reserve(request: ReserveRequest) {
    return this.post<ReserveData>('/reservations', request, request.idempotency_key);
  }

  capture(reference: string, request: CaptureRequest) {
    return this.post<CaptureData>(
      `/reservations/${encodeURIComponent(reference)}/capture`,
      request,
      request.idempotency_key,
    );
  }

  release(reference: string, request: ReleaseRequest) {
    return this.post<ReleaseData>(
      `/reservations/${encodeURIComponent(reference)}/release`,
      request,
      request.idempotency_key,
    );
  }

  status(reference: string) {
    return this.get<StatusData>(`/reservations/${encodeURIComponent(reference)}`);
  }
}
