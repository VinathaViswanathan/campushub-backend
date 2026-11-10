import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Types } from 'mongoose';
import request from 'supertest';
import { createApp } from '../../app';
import { Reservation } from '../../models/Reservation.model';
import { createResource, seededRandom } from '../../test/factories';

/** End-to-end HTTP tests: routing, validation, controllers, services, and errorHandler together. */

const app = createApp();
const API = '/api/v1';

let resourceId: string;
const body = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  resourceId,
  userId: 'student-1',
  startTime: '2026-12-01T10:00:00Z',
  endTime: '2026-12-01T11:00:00Z',
  ...overrides,
});
const book = (payload: Record<string, unknown> = body()) =>
  request(app).post(`${API}/reservations`).send(payload);

beforeEach(async () => {
  resourceId = (await createResource({ name: 'Robotics Lab', type: 'LAB' })).id;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('POST /reservations', () => {
  it('201 Created with the new PENDING reservation', async () => {
    const res = await book();

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      resourceId,
      userId: 'student-1',
      startTime: '2026-12-01T10:00:00.000Z',
      endTime: '2026-12-01T11:00:00.000Z',
      status: 'PENDING',
    });
  });

  it('409 Conflict for an overlapping booking, and the first booking is untouched', async () => {
    await book().expect(201);
    const res = await book(body({ startTime: '2026-12-01T10:30:00Z', endTime: '2026-12-01T11:30:00Z' }));

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ code: 'DOUBLE_BOOKING', message: expect.any(String) });
    expect(await Reservation.countDocuments()).toBe(1);
  });

  it('409 for an exact duplicate, 201 for a back-to-back slot', async () => {
    await book().expect(201);
    await book().expect(409);
    await book(body({ startTime: '2026-12-01T11:00:00Z', endTime: '2026-12-01T12:00:00Z' })).expect(201);
  });

  it('treats the same instant in different timezones as the same slot', async () => {
    await book().expect(201);
    // 05:00-06:00 at UTC-05:00 is exactly 10:00-11:00Z.
    await book(body({ startTime: '2026-12-01T05:00:00-05:00', endTime: '2026-12-01T06:00:00-05:00' })).expect(409);
  });

  it('only one of five simultaneous identical requests gets 201', async () => {
    const statuses = (await Promise.all(Array.from({ length: 5 }, () => book()))).map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(4);
  });

  it('404 for an unknown or malformed resourceId', async () => {
    for (const id of [new Types.ObjectId().toString(), 'res-999']) {
      const res = await book(body({ resourceId: id }));
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('RESOURCE_NOT_FOUND');
    }
  });

  it('409 RESOURCE_UNAVAILABLE for an unavailable resource', async () => {
    const closed = await createResource({ name: 'Chemistry Lab 2', type: 'LAB', isAvailable: false });
    const res = await book(body({ resourceId: closed.id }));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('RESOURCE_UNAVAILABLE');
  });

  it.each<[string, Record<string, unknown>]>([
    ['missing resourceId', { resourceId: undefined }],
    ['missing userId', { userId: undefined }],
    ['missing startTime', { startTime: undefined }],
    ['missing endTime', { endTime: undefined }],
    ['blank userId', { userId: '   ' }],
    ['numeric userId', { userId: 42 }],
    ['endTime before startTime', { startTime: '2026-12-01T11:00:00Z', endTime: '2026-12-01T10:00:00Z' }],
    ['zero-length booking', { endTime: '2026-12-01T10:00:00Z' }],
    ['startTime without timezone', { startTime: '2026-12-01T10:00:00' }],
    ['date only', { startTime: '2026-12-01' }],
    ['February 30th', { startTime: '2026-02-30T10:00:00Z', endTime: '2026-03-01T10:00:00Z' }],
    ['hour 24', { startTime: '2026-12-01T24:00:00Z' }],
    ['timestamp number', { startTime: 1796119200000 }],
    ['client sends status', { status: 'CONFIRMED' }],
    ['client sends id', { id: 'abc' }],
    ['unknown field', { roomNumber: 302 }],
  ])('400 VALIDATION_ERROR: %s', async (_label, overrides) => {
    const res = await book(body(overrides));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(await Reservation.countDocuments()).toBe(0);
  });

  it('400 INVALID_JSON for a malformed body', async () => {
    const res = await request(app)
      .post(`${API}/reservations`)
      .set('Content-Type', 'application/json')
      .send('{"resourceId": ');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_JSON');
  });

  it('never answers 500 to 200 random malformed payloads', async () => {
    const random = seededRandom(7);
    const junk: unknown[] = [null, true, 0, -1, '', ' ', 'x'.repeat(5000), [], {}, ['2026-12-01T10:00:00Z'], { $gt: '' }, '2026-13-01T10:00:00Z', '2026-12-01T10:00:00+25:00', '2026-12-01T10:00:00.123456789Z', '0000-01-01T00:00:00Z'];
    const fields = ['resourceId', 'userId', 'startTime', 'endTime'];
    const failures: string[] = [];

    for (let i = 0; i < 200; i += 1) {
      const payload = body();
      for (const field of fields) {
        if (random() < 0.4) payload[field] = junk[Math.floor(random() * junk.length)];
      }
      const res = await book(payload);
      const wellFormed = typeof res.body?.code === 'string' && typeof res.body?.message === 'string';
      if (res.status >= 500 || (res.status >= 400 && !wellFormed)) {
        failures.push(`${res.status} for ${JSON.stringify(payload).slice(0, 200)}`);
      }
      await Reservation.deleteMany({});
    }

    expect(failures).toEqual([]);
  });

  it('500 INTERNAL_ERROR (not a hang or a stack trace) when the database fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(Reservation, 'exists').mockRejectedValueOnce(new Error('simulated outage') as never);

    const res = await book();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
  });
});

describe('GET /reservations/user/:userId', () => {
  it('200 with active bookings sorted by startTime; cancelled ones are excluded', async () => {
    const later = await book(body({ startTime: '2026-12-02T10:00:00Z', endTime: '2026-12-02T11:00:00Z' }));
    const earlier = await book();
    const cancelled = await book(body({ startTime: '2026-12-03T10:00:00Z', endTime: '2026-12-03T11:00:00Z' }));
    await request(app).patch(`${API}/reservations/${cancelled.body.id}/cancel`).expect(200);

    const res = await request(app).get(`${API}/reservations/user/student-1`);
    expect(res.status).toBe(200);
    expect(res.body.map((r: { id: string }) => r.id)).toEqual([earlier.body.id, later.body.id]);
  });

  it('200 [] for a user with no bookings', async () => {
    await request(app).get(`${API}/reservations/user/nobody`).expect(200, []);
  });
});

describe('PATCH /reservations/:id/cancel and /confirm', () => {
  it('cancel returns 200 CANCELLED, frees the slot, and is idempotent', async () => {
    const { body: created } = await book();
    const res = await request(app).patch(`${API}/reservations/${created.id}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');

    await request(app).patch(`${API}/reservations/${created.id}/cancel`).expect(200);
    await book().expect(201);
  });

  it('confirm returns 200 CONFIRMED, and 409 for a cancelled booking', async () => {
    const { body: first } = await book();
    const confirmed = await request(app).patch(`${API}/reservations/${first.id}/confirm`);
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.status).toBe('CONFIRMED');

    await request(app).patch(`${API}/reservations/${first.id}/cancel`).expect(200);
    const revived = await request(app).patch(`${API}/reservations/${first.id}/confirm`);
    expect(revived.status).toBe(409);
    expect(revived.body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it.each(['cancel', 'confirm'])('%s returns 404 for unknown and malformed ids', async (action) => {
    for (const id of [new Types.ObjectId().toString(), 'rsv-999']) {
      const res = await request(app).patch(`${API}/reservations/${id}/${action}`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('RESERVATION_NOT_FOUND');
    }
  });
});

describe('GET /resources', () => {
  beforeEach(async () => {
    await createResource({ name: 'Study Room 302', type: 'ROOM' });
    await createResource({ name: 'Projector #3', type: 'EQUIPMENT' });
    await createResource({ name: 'Chemistry Lab 2', type: 'LAB', isAvailable: false });
  });

  const names = async (query: string): Promise<string[]> => {
    const res = await request(app).get(`${API}/resources${query}`).expect(200);
    return res.body.map((r: { name: string }) => r.name);
  };

  it('200 with every resource, sorted by name', async () => {
    await expect(names('')).resolves.toEqual(['Chemistry Lab 2', 'Projector #3', 'Robotics Lab', 'Study Room 302']);
  });

  it.each<[string, string[]]>([
    ['?type=LAB', ['Chemistry Lab 2', 'Robotics Lab']],
    ['?type=ROOM', ['Study Room 302']],
    ['?isAvailable=true', ['Projector #3', 'Robotics Lab', 'Study Room 302']],
    ['?isAvailable=false', ['Chemistry Lab 2']],
    ['?type=LAB&isAvailable=true', ['Robotics Lab']],
    ['?type=FOO', []],
  ])('200 with filter %s', async (query, expected) => {
    await expect(names(query)).resolves.toEqual(expected);
  });

  it.each(['?type=', '?isAvailable=yes', '?isAvailable=TRUE', '?type=ROOM&type=LAB'])(
    '400 VALIDATION_ERROR for %s',
    async (query) => {
      const res = await request(app).get(`${API}/resources${query}`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    },
  );
});

describe('unknown routes', () => {
  it('404 NOT_FOUND for paths outside the contract', async () => {
    const res = await request(app).get(`${API}/reservations`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});
