import mongoose from 'mongoose';
import { ValidationError } from '../errors/domain.errors';

/**
 * Persistence helpers for the service layer. Keeping Mongoose error types here
 * means controllers never need to know which ORM is in use.
 */

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

export function isObjectIdString(value: string): boolean {
  return OBJECT_ID_PATTERN.test(value);
}

/** Converts Mongoose validation/cast errors into domain errors; rethrows anything else. */
export function translatePersistenceError(err: unknown): never {
  if (err instanceof mongoose.Error.ValidationError) {
    const messages = Object.values(err.errors).map((e) => e.message);
    throw new ValidationError(messages.join(' '));
  }
  if (err instanceof mongoose.Error.CastError) {
    throw new ValidationError(`Invalid value for ${err.path}.`);
  }
  throw err;
}
