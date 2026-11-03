/**
 * Shared API contract types: the single declaration layer for both the Express backend
 * (src/) and the React client (client/src/). Mirrors components.schemas in
 * docs/openapi.yaml; change both together.
 *
 * This is a declaration-only (.d.ts) file on purpose: it holds no runtime values, so
 * either side can `import type` from it without build or bundler configuration.
 */

export type ResourceType = 'ROOM' | 'EQUIPMENT' | 'LAB';

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

/** components.schemas.Resource */
export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  location: string;
  isAvailable: boolean;
}

/** components.schemas.Reservation (id and status are readOnly). */
export interface Reservation {
  id: string;
  resourceId: string;
  userId: string;
  /** RFC 3339 date-time with timezone, e.g. 2026-10-01T10:00:00Z */
  startTime: string;
  endTime: string;
  status: ReservationStatus;
}

/** POST /reservations request body: Reservation minus the readOnly id and status. */
export type CreateReservationRequest = Omit<Reservation, 'id' | 'status'>;

/** components.schemas.ErrorResponse.code */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_JSON'
  | 'RESOURCE_NOT_FOUND'
  | 'RESOURCE_UNAVAILABLE'
  | 'DOUBLE_BOOKING'
  | 'RESERVATION_NOT_FOUND'
  | 'INVALID_STATUS_TRANSITION'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

/** components.schemas.ErrorResponse */
export interface ErrorResponse {
  code: ApiErrorCode;
  message: string;
}
