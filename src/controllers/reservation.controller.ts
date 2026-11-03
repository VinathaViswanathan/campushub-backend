import type { Request, Response } from 'express';
import * as reservationService from '../services/reservation.service';
import {
  parseCreateReservation,
  parseReservationIdParam,
  parseUserIdParam,
} from '../validators/reservation.validator';

/**
 * Controllers: parse input, call ONE service function, send the success status.
 * No try/catch: errors propagate to middleware/errorHandler.ts.
 */

/** POST /reservations -> 201 | 400 | 404 | 409 | 500 */
export async function createReservation(req: Request, res: Response): Promise<void> {
  const input = parseCreateReservation(req.body);
  res.status(201).json(await reservationService.createReservation(input));
}

/** GET /reservations/user/{userId} -> 200 | 400 | 500 */
export async function getUserReservations(
  req: Request<{ userId: string }>,
  res: Response,
): Promise<void> {
  const userId = parseUserIdParam(req.params);
  res.status(200).json(await reservationService.getActiveReservationsForUser(userId));
}

/** PATCH /reservations/{id}/cancel -> 200 | 400 | 404 | 500 */
export async function cancelReservation(req: Request<{ id: string }>, res: Response): Promise<void> {
  const id = parseReservationIdParam(req.params);
  res.status(200).json(await reservationService.cancelReservation(id));
}

/** PATCH /reservations/{id}/confirm -> 200 | 400 | 404 | 409 | 500 */
export async function confirmReservation(req: Request<{ id: string }>, res: Response): Promise<void> {
  const id = parseReservationIdParam(req.params);
  res.status(200).json(await reservationService.confirmReservation(id));
}
