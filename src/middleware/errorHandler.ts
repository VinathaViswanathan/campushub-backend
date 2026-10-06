import type { NextFunction, Request, Response } from 'express';

/** Fallback for paths/methods not defined in the contract. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} not found.`,
  });
}

function getBodyParserErrorType(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'type' in err && typeof err.type === 'string') {
    return err.type;
  }
  return undefined;
}

/**
 * Last-resort error handler (Express requires the 4-argument signature).
 * Handles errors raised before a controller runs, e.g. malformed JSON.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const type = getBodyParserErrorType(err);

  if (type === 'entity.parse.failed') {
    res.status(400).json({ code: 'INVALID_JSON', message: 'Request body is not valid JSON.' });
    return;
  }
  if (type !== undefined && type.startsWith('entity.')) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Request body could not be read.' });
    return;
  }

  console.error('[app] Unhandled error:', err);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
}
