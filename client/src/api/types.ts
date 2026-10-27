/**
 * TypeScript mirrors of the schemas in docs/openapi.yaml (components.schemas).
 * Keep these in lockstep with the contract: no added, renamed, or omitted fields.
 */

export const RESOURCE_TYPES = ['ROOM', 'EQUIPMENT', 'LAB'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const RESERVATION_STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/** components.schemas.Resource */
export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  location: string;
  isAvailable: boolean;
}

/** components.schemas.Reservation (response shape; id and status are readOnly). */
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
export interface CreateReservationDTO {
  resourceId: string;
  userId: string;
  startTime: string;
  endTime: string;
}

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
