import type {
  ApiErrorCode,
  CreateReservationDTO,
  ErrorResponse,
  Reservation,
  Resource,
  ResourceType,
} from './types';

/**
 * Typed client for docs/openapi.yaml. Every non-2xx response becomes an ApiError
 * carrying the HTTP status and the contract's ErrorResponse code, so components can
 * react to e.g. 409 DOUBLE_BOOKING without parsing responses themselves.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

/** Client-side codes for failures that never produced an ErrorResponse body. */
export type ClientErrorCode = 'NETWORK_ERROR' | 'UNKNOWN_ERROR';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | ClientErrorCode;

  constructor(status: number, code: ApiErrorCode | ClientErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface RequestOptions {
  /** Lets hooks abort stale requests (filter changed, component unmounted). */
  signal?: AbortSignal;
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.code === 'string' && typeof record.message === 'string';
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...init.headers },
    });
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the CampusHub server.');
  }

  const text = await response.text();
  let body: unknown;
  if (text !== '') {
    try {
      body = JSON.parse(text);
    } catch {
      body = undefined;
    }
  }

  if (!response.ok) {
    if (isErrorResponse(body)) {
      throw new ApiError(response.status, body.code, body.message);
    }
    // The backend always sends an ErrorResponse body. A 5xx without one comes from the
    // dev proxy or a gateway when the API itself is down, so report it as unreachable.
    if (response.status >= 500) {
      throw new ApiError(response.status, 'NETWORK_ERROR', 'Could not reach the CampusHub server.');
    }
    throw new ApiError(
      response.status,
      'UNKNOWN_ERROR',
      `Request failed with HTTP ${response.status}.`,
    );
  }
  return body as T;
}

/** GET /resources, with the optional `type` filter and the Lab 4 `isAvailable` filter. */
export function fetchResources(
  type?: ResourceType,
  options: RequestOptions & { isAvailable?: boolean } = {},
): Promise<Resource[]> {
  const params = new URLSearchParams();
  if (type !== undefined) params.set('type', type);
  if (options.isAvailable !== undefined) params.set('isAvailable', String(options.isAvailable));
  const query = params.toString();
  return request<Resource[]>(`/resources${query ? `?${query}` : ''}`, {
    signal: options.signal,
  });
}

/** POST /reservations. 201 returns the new PENDING reservation; 400/404/409 throw ApiError. */
export function createReservation(
  payload: CreateReservationDTO,
  options: RequestOptions = {},
): Promise<Reservation> {
  return request<Reservation>('/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: options.signal,
  });
}

/** GET /reservations/user/{userId}: the student's PENDING and CONFIRMED reservations. */
export function fetchUserReservations(
  userId: string,
  options: RequestOptions = {},
): Promise<Reservation[]> {
  return request<Reservation[]>(`/reservations/user/${encodeURIComponent(userId)}`, {
    signal: options.signal,
  });
}

/** PATCH /reservations/{id}/cancel. Returns the reservation with status CANCELLED. */
export function cancelReservation(
  reservationId: string,
  options: RequestOptions = {},
): Promise<Reservation> {
  return request<Reservation>(`/reservations/${encodeURIComponent(reservationId)}/cancel`, {
    method: 'PATCH',
    signal: options.signal,
  });
}
