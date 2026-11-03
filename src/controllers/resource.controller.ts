import type { Request, Response } from 'express';
import * as resourceService from '../services/resource.service';
import { parseResourceFilter } from '../validators/resource.validator';

/**
 * Controllers: parse input, call ONE service function, send the success status.
 * No try/catch: errors propagate to middleware/errorHandler.ts.
 */

/** GET /resources -> 200 | 400 | 500 */
export async function listResources(req: Request, res: Response): Promise<void> {
  const filter = parseResourceFilter(req.query);
  res.status(200).json(await resourceService.listResources(filter));
}
