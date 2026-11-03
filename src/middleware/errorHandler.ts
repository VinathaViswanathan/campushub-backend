import type { NextFunction, Request, Response } from 'express';
import type { ErrorResponse } from '../../shared/api-types';
import { DomainError, type DomainErrorCode } from '../errors/domain.errors';

/**
 * The single place where errors become HTTP responses. Controllers never catch:
 * Express 5 forwards anything a handler throws (or an async handler rejects with)
 * to errorHandler below. Response bodies follow ErrorResponse: { code, message }.
 */

const HTTP_STATUS_BY_CODE: Record<DomainErrorCode, number> = {
  VALIDATION_ERROR: 400,
  RESOURCE_NOT_FOUND: 404,
  RESOURCE_UNAVAILABLE: 409,
  DOUBLE_BOOKING: 409,
  RESERVATION_NOT_FOUND: 404,
  INVALID_STATUS_TRANSITION: 409,
};

function send(res: Response, status: number, body: ErrorResponse): void {
  res.status(status).json(body);
}

/** Fallback for paths/methods not defined in the contract. */
export function notFoundHandler(req: Request, res: Response): void {
  send(res, 404, { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found.` });
}

/** express.json() marks its errors with a `type` such as "entity.parse.failed". */
function getBodyParserErrorType(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'type' in err && typeof err.type === 'string') {
    return err.type;
  }
  return undefined;
}

/** Express recognizes error middleware by its 4-argument signature. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof DomainError) {
    send(res, HTTP_STATUS_BY_CODE[err.code], { code: err.code, message: err.message });
    return;
  }

  const bodyErrorType = getBodyParserErrorType(err);
  if (bodyErrorType === 'entity.parse.failed') {
    send(res, 400, { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' });
    return;
  }
  if (bodyErrorType?.startsWith('entity.')) {
    send(res, 400, { code: 'VALIDATION_ERROR', message: 'Request body could not be read.' });
    return;
  }

  console.error('[app] Unhandled error:', err);
  send(res, 500, { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
}
