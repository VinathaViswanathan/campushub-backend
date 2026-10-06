/**
 * Domain enums shared by every layer. Deliberately ORM-free so that
 * controllers and validators can use them without importing Mongoose.
 */

export const RESOURCE_TYPES = ['ROOM', 'EQUIPMENT', 'LAB'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const RESERVATION_STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/** Reservations in these states block the time slot and count as "active". */
export const ACTIVE_RESERVATION_STATUSES: readonly ReservationStatus[] = ['PENDING', 'CONFIRMED'];

export function isResourceType(value: string): value is ResourceType {
  return (RESOURCE_TYPES as readonly string[]).includes(value);
}
