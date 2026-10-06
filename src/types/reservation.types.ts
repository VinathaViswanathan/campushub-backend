import type { ReservationStatus } from '../constants/enums';

/** Matches components.schemas.Reservation exactly (additionalProperties: false). */
export interface ReservationDTO {
  id: string;
  resourceId: string;
  userId: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
}

/** POST /reservations body. `id` and `status` are readOnly and never accepted from clients. */
export interface CreateReservationInput {
  resourceId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
}
