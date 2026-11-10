import { describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import { ValidationError } from '../../errors/domain.errors';
import { Reservation } from '../../models/Reservation.model';
import { isObjectIdString, translatePersistenceError } from '../service.utils';

describe('isObjectIdString', () => {
  it.each(['665f1c2e9b1d4a0012345678', '665F1C2E9B1D4A0012345678', '000000000000000000000000'])(
    'accepts %p',
    (value) => expect(isObjectIdString(value)).toBe(true),
  );

  it.each(['', 'res-999', '665f1c2e9b1d4a001234567', '665f1c2e9b1d4a00123456789', 'g65f1c2e9b1d4a0012345678', ' 665f1c2e9b1d4a0012345678'])(
    'rejects %p',
    (value) => expect(isObjectIdString(value)).toBe(false),
  );
});

describe('translatePersistenceError', () => {
  it('turns a Mongoose ValidationError into ValidationError listing every message', async () => {
    const validationError: unknown = await new Reservation({}).validate().catch((err: unknown) => err);
    expect(validationError).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(() => translatePersistenceError(validationError)).toThrow(ValidationError);
    expect(() => translatePersistenceError(validationError)).toThrow('resourceId is required');
  });

  it('turns a Mongoose CastError into ValidationError naming the field', () => {
    const castError = new mongoose.Error.CastError('ObjectId', 'not-an-id', 'resourceId');
    expect(() => translatePersistenceError(castError)).toThrow(ValidationError);
    expect(() => translatePersistenceError(castError)).toThrow('Invalid value for resourceId.');
  });

  it('rethrows anything else unchanged, so real failures reach the 500 handler', () => {
    const outage = new Error('connection reset');
    expect(() => translatePersistenceError(outage)).toThrow(outage);
  });
});
