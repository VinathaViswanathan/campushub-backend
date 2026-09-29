/**
 * Express routes for the CampusHub Reservation API.
 * Contract: docs/openapi.yaml — mounted under /api/v1 (see src/app.ts).
 *
 *   GET  /resources                    -> 200 | 400 | 500
 *   POST /reservations                 -> 201 | 400 | 404 | 409 | 500
 *   GET  /reservations/user/{userId}   -> 200 | 400 | 500
 */
import { Router, type Request, type Response } from 'express';
import {
  HttpStatus,
  type CreateReservationResponses,
  type ErrorResponse,
  type GetUserReservationsResponses,
  type ListResourcesResponses,
  type UserReservationsParams,
} from '../types/reservation';
import { createReservation, listActiveReservationsForUser, listResources } from '../services/reservation.service';
import { validateCreateReservation, validateListResourcesQuery, validateUserId } from '../validators/reservation.validator';

/**
 * Builds a typed sender for one operation: the compiler only accepts status codes
 * declared for that operation, and only the body type the contract defines for that code.
 */
function responder<R>() {
  return <S extends keyof R & number>(res: Response, status: S, body: R[S]): void => {
    res.status(status).json(body);
  };
}

const sendListResources = responder<ListResourcesResponses>();
const sendCreateReservation = responder<CreateReservationResponses>();
const sendUserReservations = responder<GetUserReservationsResponses>();

const internalError = (err: unknown): ErrorResponse => {
  console.error(err);
  return { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' };
};

const router = Router();

// GET /resources?type=ROOM
router.get('/resources', (req: Request, res: Response) => {
  try {
    const query = validateListResourcesQuery(req.query);
    if (!query.ok) return sendListResources(res, HttpStatus.BAD_REQUEST, query.error);
    return sendListResources(res, HttpStatus.OK, listResources(query.value.type));
  } catch (err) {
    return sendListResources(res, HttpStatus.INTERNAL_SERVER_ERROR, internalError(err));
  }
});

// POST /reservations
router.post('/reservations', (req: Request, res: Response) => {
  try {
    const body = validateCreateReservation(req.body);
    if (!body.ok) return sendCreateReservation(res, HttpStatus.BAD_REQUEST, body.error);

    const result = createReservation(body.value);
    if (result.ok) return sendCreateReservation(res, HttpStatus.CREATED, result.reservation);

    const error: ErrorResponse = { code: result.code, message: result.message };
    if (result.code === 'RESOURCE_NOT_FOUND') return sendCreateReservation(res, HttpStatus.NOT_FOUND, error);
    return sendCreateReservation(res, HttpStatus.CONFLICT, error); // DOUBLE_BOOKING | RESOURCE_UNAVAILABLE
  } catch (err) {
    return sendCreateReservation(res, HttpStatus.INTERNAL_SERVER_ERROR, internalError(err));
  }
});

// GET /reservations/user/:userId
router.get('/reservations/user/:userId', (req: Request<UserReservationsParams>, res: Response) => {
  try {
    const userId = validateUserId(req.params.userId);
    if (!userId.ok) return sendUserReservations(res, HttpStatus.BAD_REQUEST, userId.error);
    return sendUserReservations(res, HttpStatus.OK, listActiveReservationsForUser(userId.value));
  } catch (err) {
    return sendUserReservations(res, HttpStatus.INTERNAL_SERVER_ERROR, internalError(err));
  }
});

export default router;
