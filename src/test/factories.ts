import { Resource, type IResource, type ResourceDocument } from '../models/Resource.model';
import type { CreateReservationInput } from '../types/reservation.types';

/** Test-data helpers shared by the service and route tests. */

export async function createResource(overrides: Partial<IResource> = {}): Promise<ResourceDocument> {
  return Resource.create({
    name: 'Study Room 302',
    type: 'ROOM',
    location: 'Library, Floor 3',
    isAvailable: true,
    ...overrides,
  });
}

/** Parses an ISO string, failing loudly on a typo in the test itself. */
export function at(iso: string): Date {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error(`Bad test date: ${iso}`);
  return date;
}

export function reservationInput(
  resourceId: string,
  start: Date,
  end: Date,
  userId = 'student-1',
): CreateReservationInput {
  return { resourceId, userId, startTime: start, endTime: end };
}

/** Deterministic PRNG (mulberry32), so a failing fuzz case can be reproduced exactly. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
