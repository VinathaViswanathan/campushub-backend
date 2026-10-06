import type { Request, Response } from 'express';
import * as reservationService from '../services/reservation.service';
import { parseCreateReservation, parseUserIdParam } from '../validators/reservation.validator';
import { sendError } from './controller.utils';

/**
 * Controllers ONLY: (1) extract input from req, (2) call a service function,
 * (3) choose the HTTP status code and send the response.
 * No ORM/model imports are allowed in this folder.
 */

/** POST /reservations -> 201 | 400 | 404 | 409 | 500 */
export async function createReservation(req: Request, res: Response): Promise<void> {
  try {
    const input = parseCreateReservation(req.body);
    const created = await reservationService.createReservation(input);
    res.status(201).json(created);
  } catch (err) {
    sendError(res, err);
  }
}

/** GET /reservations/user/{userId} -> 200 | 400 | 500 */
export async function getUserReservations(
  req: Request<{ userId: string }>,
  res: Response,
): Promise<void> {
  try {
    const userId = parseUserIdParam(req.params);
    const reservations = await reservationService.getActiveReservationsForUser(userId);
    res.status(200).json(reservations);
  } catch (err) {
    sendError(res, err);
  }
}
