import type { Response } from 'express';
import { DomainError, type DomainErrorCode } from '../errors/domain.errors';

/**
 * The single place where domain errors become HTTP status codes.
 * Response bodies follow components.schemas.ErrorResponse: { code, message }.
 */

const HTTP_STATUS_BY_CODE: Record<DomainErrorCode, number> = {
  VALIDATION_ERROR: 400,
  RESOURCE_NOT_FOUND: 404,
  RESOURCE_UNAVAILABLE: 409,
  DOUBLE_BOOKING: 409,
};

export interface ErrorResponseBody {
  code: string;
  message: string;
}

export function sendError(res: Response, err: unknown): void {
  if (err instanceof DomainError) {
    const body: ErrorResponseBody = { code: err.code, message: err.message };
    res.status(HTTP_STATUS_BY_CODE[err.code]).json(body);
    return;
  }

  console.error('[controller] Unexpected error:', err);
  const body: ErrorResponseBody = {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred.',
  };
  res.status(500).json(body);
}
