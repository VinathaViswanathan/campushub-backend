import { ACTIVE_RESERVATION_STATUSES } from '../constants/enums';
import {
  DoubleBookingError,
  ResourceNotFoundError,
  ResourceUnavailableError,
  ValidationError,
} from '../errors/domain.errors';
import { Reservation, type ReservationDocument } from '../models/Reservation.model';
import { Resource } from '../models/Resource.model';
import type { CreateReservationInput, ReservationDTO } from '../types/reservation.types';
import { isObjectIdString, translatePersistenceError } from './service.utils';

/**
 * Reservation business logic + persistence.
 * No Express imports, no req/res, no HTTP status codes.
 */

function toReservationDTO(doc: ReservationDocument): ReservationDTO {
  return {
    id: doc._id.toString(),
    resourceId: doc.resourceId.toString(),
    userId: doc.userId,
    startTime: doc.startTime.toISOString(),
    endTime: doc.endTime.toISOString(),
    status: doc.status,
  };
}

/**
 * Business rules:
 *  1. endTime must be later than startTime                    -> VALIDATION_ERROR
 *  2. the resource must exist                                 -> RESOURCE_NOT_FOUND
 *     (a resourceId that is not a valid ObjectId cannot exist, so it is also "not found")
 *  3. the resource must be available                          -> RESOURCE_UNAVAILABLE
 *  4. no overlapping PENDING/CONFIRMED booking on resource    -> DOUBLE_BOOKING
 * New reservations always start as PENDING.
 */
export async function createReservation(input: CreateReservationInput): Promise<ReservationDTO> {
  if (input.endTime.getTime() <= input.startTime.getTime()) {
    throw new ValidationError('endTime must be later than startTime.');
  }

  const notFoundMessage = `Resource ${input.resourceId} does not exist.`;
  if (!isObjectIdString(input.resourceId)) {
    throw new ResourceNotFoundError(notFoundMessage);
  }

  const resource = await Resource.findById(input.resourceId);
  if (!resource) {
    throw new ResourceNotFoundError(notFoundMessage);
  }
  if (!resource.isAvailable) {
    throw new ResourceUnavailableError(`Resource ${input.resourceId} is not available.`);
  }

  // Two windows overlap when each one starts before the other ends
  // (back-to-back bookings, where one ends exactly as the next starts, are allowed).
  const overlapping = await Reservation.exists({
    resourceId: resource._id,
    status: { $in: [...ACTIVE_RESERVATION_STATUSES] },
    startTime: { $lt: input.endTime },
    endTime: { $gt: input.startTime },
  });
  if (overlapping) {
    throw new DoubleBookingError('Resource is already reserved for this time slot.');
  }

  try {
    const doc = await Reservation.create({
      resourceId: resource._id,
      userId: input.userId,
      startTime: input.startTime,
      endTime: input.endTime,
      status: 'PENDING',
    });
    return toReservationDTO(doc);
  } catch (err) {
    return translatePersistenceError(err);
  }
}

/** A user's active (PENDING or CONFIRMED) reservations, sorted by startTime. */
export async function getActiveReservationsForUser(userId: string): Promise<ReservationDTO[]> {
  const docs = await Reservation.find({
    userId,
    status: { $in: [...ACTIVE_RESERVATION_STATUSES] },
  }).sort({ startTime: 1, _id: 1 });
  return docs.map(toReservationDTO);
}
