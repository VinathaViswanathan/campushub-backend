import type { Request, Response } from 'express';
import * as resourceService from '../services/resource.service';
import { parseResourceFilter } from '../validators/resource.validator';
import { sendError } from './controller.utils';

/**
 * Controllers ONLY: (1) extract input from req, (2) call a service function,
 * (3) choose the HTTP status code and send the response.
 * No ORM/model imports are allowed in this folder.
 */

/** GET /resources -> 200 | 400 | 500 */
export async function listResources(req: Request, res: Response): Promise<void> {
  try {
    const filter = parseResourceFilter(req.query);
    const resources = await resourceService.listResources(filter);
    res.status(200).json(resources);
  } catch (err) {
    sendError(res, err);
  }
}
