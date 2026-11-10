import { beforeEach, describe, expect, it } from '@jest/globals';
import { Types } from 'mongoose';
import {
  DoubleBookingError,
  InvalidStatusTransitionError,
  ReservationNotFoundError,
  ResourceNotFoundError,
  ResourceUnavailableError,
  ValidationError,
} from '../../errors/domain.errors';
import { Reservation } from '../../models/Reservation.model';
import { at, createResource, reservationInput, seededRandom } from '../../test/factories';
import {
  cancelReservation,
  confirmReservation,
  createReservation,
  getActiveReservationsForUser,
} from '../reservation.service';

/**
 * Service-layer tests against a real (in-memory) MongoDB: no mocks, so the overlap
 * query, casting, and validation run exactly as in production.
 */

const MS = 1;
const TEN = at('2026-12-01T10:00:00.000Z');
const ELEVEN = at('2026-12-01T11:00:00.000Z');
const plus = (date: Date, ms: number): Date => new Date(date.getTime() + ms);
const minutes = (n: number): number => n * 60_000;

let resourceId: string;

beforeEach(async () => {
  resourceId = (await createResource()).id;
});

describe('createReservation: happy path', () => {
  it('creates a PENDING reservation and returns only the contract fields', async () => {
    const result = await createReservation(reservationInput(resourceId, TEN, ELEVEN));

    expect(result).toEqual({
      id: expect.any(String),
      resourceId,
      userId: 'student-1',
      startTime: '2026-12-01T10:00:00.000Z',
      endTime: '2026-12-01T11:00:00.000Z',
      status: 'PENDING',
    });
    expect(await Reservation.countDocuments()).toBe(1);
  });

  it('allows the same time slot on a different resource', async () => {
    const otherId = (await createResource({ name: 'Robotics Lab', type: 'LAB' })).id;
    await createReservation(reservationInput(resourceId, TEN, ELEVEN));

    await expect(createReservation(reservationInput(otherId, TEN, ELEVEN))).resolves.toMatchObject({
      resourceId: otherId,
    });
  });
});

describe('createReservation: time-range validation', () => {
  it.each<[string, Date, Date]>([
    ['endTime before startTime', ELEVEN, TEN],
    ['endTime equal to startTime (zero length)', TEN, TEN],
    ['endTime 1 ms before startTime', TEN, plus(TEN, -MS)],
  ])('rejects %s with ValidationError and stores nothing', async (_label, start, end) => {
    await expect(createReservation(reservationInput(resourceId, start, end))).rejects.toThrow(
      ValidationError,
    );
    expect(await Reservation.countDocuments()).toBe(0);
  });

  it('accepts the shortest valid booking (1 ms)', async () => {
    await expect(createReservation(reservationInput(resourceId, TEN, plus(TEN, MS)))).resolves.toMatchObject({
      status: 'PENDING',
    });
  });

  it('turns a Mongoose validation failure into ValidationError (blank userId)', async () => {
    // The HTTP validator blocks this earlier; the service must still not leak a Mongoose error.
    await expect(
      createReservation(reservationInput(resourceId, TEN, ELEVEN, '   ')),
    ).rejects.toThrow(ValidationError);
  });
});

describe('createReservation: resource lookup', () => {
  it('rejects a well-formed but non-existent resourceId', async () => {
    const missing = new Types.ObjectId().toString();
    await expect(createReservation(reservationInput(missing, TEN, ELEVEN))).rejects.toThrow(
      ResourceNotFoundError,
    );
  });

  it.each(['res-999', '', '665f1c2e9b1d4a00123456', '665f1c2e9b1d4a001234567890', 'zzzzzzzzzzzzzzzzzzzzzzzz'])(
    'treats malformed resourceId %p as not found (no CastError leaks)',
    async (badId) => {
      await expect(createReservation(reservationInput(badId, TEN, ELEVEN))).rejects.toThrow(
        ResourceNotFoundError,
      );
    },
  );

  it('rejects an unavailable resource', async () => {
    const closedId = (await createResource({ name: 'Chemistry Lab 2', isAvailable: false })).id;
    await expect(createReservation(reservationInput(closedId, TEN, ELEVEN))).rejects.toThrow(
      ResourceUnavailableError,
    );
  });
});

describe('createReservation: double-booking boundaries against 10:00-11:00', () => {
  beforeEach(async () => {
    await createReservation(reservationInput(resourceId, TEN, ELEVEN, 'first-student'));
  });

  it.each<[string, Date, Date]>([
    ['exact same start and end', TEN, ELEVEN],
    ['same start, shorter end', TEN, plus(TEN, minutes(30))],
    ['same end, later start', plus(TEN, minutes(30)), ELEVEN],
    ['overlaps the start by 1 ms', plus(TEN, -minutes(60)), plus(TEN, MS)],
    ['overlaps the end by 1 ms', plus(ELEVEN, -MS), plus(ELEVEN, minutes(60))],
    ['fully inside the existing booking', plus(TEN, minutes(15)), plus(TEN, minutes(45))],
    ['fully containing the existing booking', plus(TEN, -minutes(60)), plus(ELEVEN, minutes(60))],
  ])('rejects %s', async (_label, start, end) => {
    await expect(createReservation(reservationInput(resourceId, start, end))).rejects.toThrow(
      DoubleBookingError,
    );
    expect(await Reservation.countDocuments()).toBe(1);
  });

  it.each<[string, Date, Date]>([
    ['back-to-back before (ends exactly at 10:00)', plus(TEN, -minutes(60)), TEN],
    ['back-to-back after (starts exactly at 11:00)', ELEVEN, plus(ELEVEN, minutes(60))],
    ['1 ms gap before', plus(TEN, -minutes(60)), plus(TEN, -MS)],
    ['1 ms gap after', plus(ELEVEN, MS), plus(ELEVEN, minutes(60))],
  ])('allows %s', async (_label, start, end) => {
    await expect(createReservation(reservationInput(resourceId, start, end))).resolves.toMatchObject({
      status: 'PENDING',
    });
  });

  it('a CONFIRMED booking blocks the slot too', async () => {
    const [existing] = await getActiveReservationsForUser('first-student');
    await confirmReservation(existing!.id);
    await expect(createReservation(reservationInput(resourceId, TEN, ELEVEN))).rejects.toThrow(
      DoubleBookingError,
    );
  });

  it('a CANCELLED booking does not block the slot', async () => {
    const [existing] = await getActiveReservationsForUser('first-student');
    await cancelReservation(existing!.id);
    await expect(createReservation(reservationInput(resourceId, TEN, ELEVEN))).resolves.toMatchObject({
      status: 'PENDING',
    });
  });
});

describe('createReservation: boundary fuzzing', () => {
  it('matches the overlap formula for 300 random intervals clustered around the boundaries', async () => {
    await createReservation(reservationInput(resourceId, TEN, ELEVEN, 'first-student'));
    const random = seededRandom(5500);
    // Offsets biased toward the edges: exactly on them, 1 ms either side, or anywhere within 2 h.
    const edges = [TEN.getTime(), ELEVEN.getTime()];
    const pick = (): number => {
      const edge = edges[Math.floor(random() * edges.length)]!;
      const roll = random();
      if (roll < 0.25) return edge;
      if (roll < 0.5) return edge + (random() < 0.5 ? -MS : MS);
      return edge + Math.round((random() - 0.5) * minutes(240));
    };

    const mismatches: string[] = [];
    for (let i = 0; i < 300; i += 1) {
      const a = pick();
      const b = pick();
      const start = new Date(Math.min(a, b));
      const end = new Date(Math.max(a, b));
      const expected =
        end.getTime() <= start.getTime()
          ? 'ValidationError'
          : start.getTime() < ELEVEN.getTime() && end.getTime() > TEN.getTime()
            ? 'DoubleBookingError'
            : 'created';

      let actual: string;
      try {
        const created = await createReservation(reservationInput(resourceId, start, end));
        actual = 'created';
        await Reservation.deleteOne({ _id: created.id }); // keep only the 10:00-11:00 booking
      } catch (err) {
        actual = err instanceof Error ? err.constructor.name : String(err);
      }
      if (actual !== expected) {
        mismatches.push(`${start.toISOString()} - ${end.toISOString()}: expected ${expected}, got ${actual}`);
      }
    }

    expect(mismatches).toEqual([]);
    expect(await Reservation.countDocuments()).toBe(1);
  });
});

describe('createReservation: concurrent booking attempts', () => {
  it('lets exactly one of five simultaneous identical requests succeed', async () => {
    const attempts = Array.from({ length: 5 }, (_, i) =>
      createReservation(reservationInput(resourceId, TEN, ELEVEN, `student-${i}`)),
    );
    const results = await Promise.allSettled(attempts);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected).toHaveLength(4);
    rejected.forEach((r) => expect(r.reason).toBeInstanceOf(DoubleBookingError));
    expect(await Reservation.countDocuments()).toBe(1);
  });

  it('does not block simultaneous requests for different slots or resources', async () => {
    const otherId = (await createResource({ name: 'Projector #3', type: 'EQUIPMENT' })).id;
    const results = await Promise.allSettled([
      createReservation(reservationInput(resourceId, TEN, ELEVEN)),
      createReservation(reservationInput(resourceId, ELEVEN, plus(ELEVEN, minutes(60)))),
      createReservation(reservationInput(otherId, TEN, ELEVEN)),
    ]);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(await Reservation.countDocuments()).toBe(3);
  });
});

describe('getActiveReservationsForUser', () => {
  it('returns only PENDING and CONFIRMED bookings for that user, sorted by startTime', async () => {
    const late = await createReservation(reservationInput(resourceId, plus(TEN, minutes(240)), plus(TEN, minutes(300))));
    const early = await createReservation(reservationInput(resourceId, TEN, ELEVEN));
    const cancelled = await createReservation(reservationInput(resourceId, plus(TEN, minutes(120)), plus(TEN, minutes(180))));
    await cancelReservation(cancelled.id);
    await confirmReservation(late.id);
    await createReservation(reservationInput(resourceId, plus(TEN, minutes(600)), plus(TEN, minutes(660)), 'someone-else'));

    const list = await getActiveReservationsForUser('student-1');
    expect(list.map((r) => r.id)).toEqual([early.id, late.id]);
    expect(list.map((r) => r.status)).toEqual(['PENDING', 'CONFIRMED']);
  });

  it('returns an empty list for an unknown user', async () => {
    await expect(getActiveReservationsForUser('nobody')).resolves.toEqual([]);
  });
});

describe('cancelReservation', () => {
  it('cancels a booking and immediately frees the slot', async () => {
    const booking = await createReservation(reservationInput(resourceId, TEN, ELEVEN));

    await expect(cancelReservation(booking.id)).resolves.toMatchObject({ id: booking.id, status: 'CANCELLED' });
    await expect(createReservation(reservationInput(resourceId, TEN, ELEVEN))).resolves.toMatchObject({
      status: 'PENDING',
    });
  });

  it('is idempotent: cancelling twice returns the same CANCELLED booking', async () => {
    const booking = await createReservation(reservationInput(resourceId, TEN, ELEVEN));
    await cancelReservation(booking.id);
    await expect(cancelReservation(booking.id)).resolves.toMatchObject({ status: 'CANCELLED' });
  });

  it.each([new Types.ObjectId().toString(), 'rsv-999'])('rejects unknown id %p', async (id) => {
    await expect(cancelReservation(id)).rejects.toThrow(ReservationNotFoundError);
  });
});

describe('confirmReservation', () => {
  it('confirms a PENDING booking, and confirming again is a no-op', async () => {
    const booking = await createReservation(reservationInput(resourceId, TEN, ELEVEN));
    await expect(confirmReservation(booking.id)).resolves.toMatchObject({ status: 'CONFIRMED' });
    await expect(confirmReservation(booking.id)).resolves.toMatchObject({ status: 'CONFIRMED' });
  });

  it('refuses to revive a CANCELLED booking', async () => {
    const booking = await createReservation(reservationInput(resourceId, TEN, ELEVEN));
    await cancelReservation(booking.id);
    await expect(confirmReservation(booking.id)).rejects.toThrow(InvalidStatusTransitionError);
  });

  it.each([new Types.ObjectId().toString(), 'rsv-999'])('rejects unknown id %p', async (id) => {
    await expect(confirmReservation(id)).rejects.toThrow(ReservationNotFoundError);
  });
});
