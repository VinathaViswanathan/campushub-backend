/**
 * TypeScript types for the CampusHub Reservation API.
 *
 * Source of truth: docs/openapi.yaml (components/schemas + path responses).
 * Do NOT add, rename, or remove fields here without changing the contract first.
 */

// ---------- Enums (components/schemas/*/enum) ----------

export const RESOURCE_TYPES = ['ROOM', 'EQUIPMENT', 'LAB'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const RESERVATION_STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/** Statuses that count as "active" (they block the time slot and are returned by GET /reservations/user/{userId}). */
export const ACTIVE_RESERVATION_STATUSES: readonly ReservationStatus[] = ['PENDING', 'CONFIRMED'];

export const USER_ROLES = ['STUDENT', 'STAFF', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'INVALID_JSON',
  'RESOURCE_NOT_FOUND',
  'RESOURCE_UNAVAILABLE',
  'DOUBLE_BOOKING',
  'NOT_FOUND',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** ISO 8601 date-time string, e.g. "2026-10-01T10:00:00Z" (OpenAPI `format: date-time`). */
export type IsoDateTimeString = string;

// ---------- Schemas (components/schemas) ----------

/** components/schemas/User */
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

/** components/schemas/Resource */
export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  location: string;
  isAvailable: boolean;
}

/** components/schemas/Reservation (as returned in responses). */
export interface Reservation {
  /** readOnly — assigned by the server. */
  readonly id: string;
  resourceId: string;
  userId: string;
  startTime: IsoDateTimeString;
  endTime: IsoDateTimeString;
  /** readOnly — assigned by the server. */
  readonly status: ReservationStatus;
}

/**
 * POST /reservations request body: the Reservation schema minus its readOnly
 * properties (`id`, `status`), per OpenAPI 3.0 readOnly semantics.
 */
export type CreateReservationRequest = Omit<Reservation, 'id' | 'status'>;

/** components/schemas/ErrorResponse */
export interface ErrorResponse {
  code: ErrorCode;
  message: string;
}

// ---------- Parameters ----------

/** GET /resources query parameters. */
export interface ListResourcesQuery {
  type?: string;
}

/** GET /reservations/user/{userId} path parameters. */
export interface UserReservationsParams {
  userId: string;
}

// ---------- HTTP status codes used by the contract ----------

export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// ---------- Response maps: status code -> body type, one per operation ----------

/** GET /resources (operationId: listResources) */
export interface ListResourcesResponses {
  200: Resource[];
  400: ErrorResponse;
  500: ErrorResponse;
}

/** POST /reservations (operationId: createReservation) */
export interface CreateReservationResponses {
  201: Reservation;
  400: ErrorResponse;
  404: ErrorResponse;
  409: ErrorResponse;
  500: ErrorResponse;
}

/** GET /reservations/user/{userId} (operationId: getUserReservations) */
export interface GetUserReservationsResponses {
  200: Reservation[];
  400: ErrorResponse;
  500: ErrorResponse;
}
