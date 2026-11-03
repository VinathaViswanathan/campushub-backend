/** Response shape comes from the shared contract layer. */
export type { Reservation as ReservationDTO } from '../../shared/api-types';

/** Validated POST /reservations body, with times parsed to Date (backend-internal). */
export interface CreateReservationInput {
  resourceId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
}
