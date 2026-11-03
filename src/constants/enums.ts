import type { ReservationStatus, ResourceType } from '../../shared/api-types';

/**
 * Runtime lists of the shared enum types. The Record keys force every member of the
 * shared union to be listed, so these can never drift from shared/api-types.d.ts.
 */
const RESOURCE_TYPE_KEYS: Record<ResourceType, true> = { ROOM: true, EQUIPMENT: true, LAB: true };
const RESERVATION_STATUS_KEYS: Record<ReservationStatus, true> = {
  PENDING: true,
  CONFIRMED: true,
  CANCELLED: true,
};

export type { ReservationStatus, ResourceType };

export const RESOURCE_TYPES = Object.keys(RESOURCE_TYPE_KEYS) as readonly ResourceType[];
export const RESERVATION_STATUSES = Object.keys(RESERVATION_STATUS_KEYS) as readonly ReservationStatus[];

/** Reservations in these states block the time slot and count as "active". */
export const ACTIVE_RESERVATION_STATUSES: readonly ReservationStatus[] = ['PENDING', 'CONFIRMED'];

export function isResourceType(value: string): value is ResourceType {
  return (RESOURCE_TYPES as readonly string[]).includes(value);
}
