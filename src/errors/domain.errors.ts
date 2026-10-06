/**
 * Domain errors thrown by the validator and service layers.
 * Each carries a machine-readable code from the OpenAPI ErrorResponse enum,
 * but NO HTTP status; controllers decide the status code.
 */

export type DomainErrorCode =
  | 'VALIDATION_ERROR'
  | 'RESOURCE_NOT_FOUND'
  | 'RESOURCE_UNAVAILABLE'
  | 'DOUBLE_BOOKING';

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
