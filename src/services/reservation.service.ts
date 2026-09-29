/**
 * Minimal in-memory service layer for local testing (no database required).
 * Data resets every time the server restarts.
 */
import { randomUUID } from 'node:crypto';
import {
  ACTIVE_RESERVATION_STATUSES,
  type CreateReservationRequest,
  type ErrorCode,
  type Reservation,
  type Resource,
} from '../types/reservation';

const resources: Resource[] = [
  { id: 'res-101', name: 'Study Room 302', type: 'ROOM', location: 'Library, Floor 3', isAvailable: true },
  { id: 'res-102', name: '3D Printer A', type: 'EQUIPMENT', location: 'Makerspace, Room 110', isAvailable: true },
  { id: 'res-103', name: 'Robotics Lab', type: 'LAB', location: 'Engineering Building, Room 204', isAvailable: true },
  { id: 'res-104', name: 'Study Room 305', type: 'ROOM', location: 'Library, Floor 3', isAvailable: false },
];

const reservations: Reservation[] = [];

export function listResources(type?: string): Resource[] {
  return type === undefined ? [...resources] : resources.filter((r) => r.type === type);
}

export function listActiveReservationsForUser(userId: string): Reservation[] {
  return reservations
    .filter((r) => r.userId === userId && ACTIVE_RESERVATION_STATUSES.includes(r.status))
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
}

export type CreateReservationResult =
  | { ok: true; reservation: Reservation }
  | { ok: false; code: Extract<ErrorCode, 'RESOURCE_NOT_FOUND' | 'RESOURCE_UNAVAILABLE' | 'DOUBLE_BOOKING'>; message: string };

/** Two blocks overlap when each starts before the other ends. Back-to-back slots (10–11, 11–12) do not overlap. */
const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean =>
  aStart < bEnd && bStart < aEnd;

export function createReservation(input: CreateReservationRequest): CreateReservationResult {
  const resource = resources.find((r) => r.id === input.resourceId);
  if (!resource) {
    return { ok: false, code: 'RESOURCE_NOT_FOUND', message: `Resource ${input.resourceId} does not exist.` };
  }
  if (!resource.isAvailable) {
    return { ok: false, code: 'RESOURCE_UNAVAILABLE', message: `Resource ${input.resourceId} is not available for reservation.` };
  }

  // Compare as epoch ms so different timezone offsets are handled correctly.
  const start = Date.parse(input.startTime);
  const end = Date.parse(input.endTime);
  const conflict = reservations.some(
    (r) =>
      r.resourceId === input.resourceId &&
      ACTIVE_RESERVATION_STATUSES.includes(r.status) &&
      overlaps(start, end, Date.parse(r.startTime), Date.parse(r.endTime)),
  );
  if (conflict) {
    return { ok: false, code: 'DOUBLE_BOOKING', message: 'Resource is already reserved for this time slot.' };
  }

  const reservation: Reservation = {
    id: `rsv-${randomUUID()}`,
    resourceId: input.resourceId,
    userId: input.userId,
    startTime: input.startTime,
    endTime: input.endTime,
    status: 'PENDING',
  };
  reservations.push(reservation);
  return { ok: true, reservation };
}
