import type { ResourceType } from '../../../shared/api-types';

/** Contract types live in shared/api-types.d.ts (shared with the backend). */
export type {
  ApiErrorCode,
  CreateReservationRequest,
  ErrorResponse,
  Reservation,
  ReservationStatus,
  Resource,
  ResourceType,
} from '../../../shared/api-types';

/** Runtime list in display order. The Record keys force every ResourceType to appear. */
const RESOURCE_TYPE_KEYS: Record<ResourceType, true> = { ROOM: true, EQUIPMENT: true, LAB: true };
export const RESOURCE_TYPES = Object.keys(RESOURCE_TYPE_KEYS) as ResourceType[];
