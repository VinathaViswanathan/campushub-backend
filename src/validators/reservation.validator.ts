import type { CreateReservationInput } from '../types/reservation.types';
import {
  asRecord,
  failValidation,
  readDateTime,
  readNonEmptyString,
  rejectUnknownKeys,
} from './common';

const CREATE_FIELDS = ['resourceId', 'userId', 'startTime', 'endTime'] as const;
const READ_ONLY_FIELDS = ['id', 'status'] as const;

/** POST /reservations body. */
export function parseCreateReservation(body: unknown): CreateReservationInput {
  const src = asRecord(body);
  const errors: string[] = [];

  rejectUnknownKeys(src, CREATE_FIELDS, READ_ONLY_FIELDS, errors);
  const resourceId = readNonEmptyString(src, 'resourceId', errors);
  const userId = readNonEmptyString(src, 'userId', errors);
  const startTime = readDateTime(src, 'startTime', errors);
  const endTime = readDateTime(src, 'endTime', errors);

  if (
    errors.length > 0 ||
    resourceId === undefined ||
    userId === undefined ||
    startTime === undefined ||
    endTime === undefined
  ) {
    return failValidation(errors);
  }
  return { resourceId, userId, startTime, endTime };
}

/** GET /reservations/user/{userId} path parameter. */
export function parseUserIdParam(params: unknown): string {
  const src = asRecord(params, 'Path parameters');
  const errors: string[] = [];
  const userId = readNonEmptyString(src, 'userId', errors);

  if (errors.length > 0 || userId === undefined) {
    return failValidation(errors);
  }
  return userId;
}
