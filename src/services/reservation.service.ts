import { ACTIVE_RESERVATION_STATUSES } from '../constants/enums';
import {
  DoubleBookingError,
  InvalidStatusTransitionError,
  ReservationNotFoundError,
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

/**
 * Transitions a reservation to CANCELLED.
 *  - unknown id (including one that is not a valid ObjectId)  -> RESERVATION_NOT_FOUND
 *  - already CANCELLED                                        -> no-op, returns it unchanged
 * Because the overlap check in createReservation only looks at PENDING/CONFIRMED,
 * a CANCELLED reservation frees its time slot immediately.
 */
export async function cancelReservation(id: string): Promise<ReservationDTO> {
  const notFoundMessage = `Reservation ${id} does not exist.`;
  if (!isObjectIdString(id)) {
    throw new ReservationNotFoundError(notFoundMessage);
  }

  // Single atomic update: no read-then-write race with a concurrent confirm.
  const doc = await Reservation.findOneAndUpdate(
    { _id: id },
    { $set: { status: 'CANCELLED' } },
    { returnDocument: 'after' },
  );
  if (!doc) {
    throw new ReservationNotFoundError(notFoundMessage);
  }
  return toReservationDTO(doc);
}

/**
 * Transitions a reservation to CONFIRMED.
 *  - unknown id (including one that is not a valid ObjectId)  -> RESERVATION_NOT_FOUND
 *  - PENDING or already CONFIRMED                             -> CONFIRMED
 *  - CANCELLED                                                -> INVALID_STATUS_TRANSITION
 *    (its slot may already have been re-booked, so it cannot be revived)
 */
export async function confirmReservation(id: string): Promise<ReservationDTO> {
  const notFoundMessage = `Reservation ${id} does not exist.`;
  if (!isObjectIdString(id)) {
    throw new ReservationNotFoundError(notFoundMessage);
  }

  // The status guard is part of the filter, so a reservation cancelled concurrently
  // can never be flipped back to CONFIRMED.
  const doc = await Reservation.findOneAndUpdate(
    { _id: id, status: { $in: [...ACTIVE_RESERVATION_STATUSES] } },
    { $set: { status: 'CONFIRMED' } },
    { returnDocument: 'after' },
  );
  if (doc) {
    return toReservationDTO(doc);
  }

  const exists = await Reservation.exists({ _id: id });
  if (!exists) {
    throw new ReservationNotFoundError(notFoundMessage);
  }
  throw new InvalidStatusTransitionError(
    `Reservation ${id} is CANCELLED and cannot be confirmed.`,
  );
}
