import type { ApiErrorCode } from '../../shared/api-types';

/**
 * Domain errors thrown by the validator and service layers. Each carries a code from
 * the shared ApiErrorCode union but no HTTP status; middleware/errorHandler.ts maps
 * codes to statuses. Transport-level codes are excluded because only middleware
 * produces them.
 */
export type DomainErrorCode = Exclude<ApiErrorCode, 'INVALID_JSON' | 'NOT_FOUND' | 'INTERNAL_ERROR'>;

export abstract class DomainError extends Error {
  abstract readonly code: DomainErrorCode;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR' as const;
}

export class ResourceNotFoundError extends DomainError {
  readonly code = 'RESOURCE_NOT_FOUND' as const;
}

export class ResourceUnavailableError extends DomainError {
  readonly code = 'RESOURCE_UNAVAILABLE' as const;
}

export class DoubleBookingError extends DomainError {
  readonly code = 'DOUBLE_BOOKING' as const;
}

export class ReservationNotFoundError extends DomainError {
  readonly code = 'RESERVATION_NOT_FOUND' as const;
}

export class InvalidStatusTransitionError extends DomainError {
  readonly code = 'INVALID_STATUS_TRANSITION' as const;
}
