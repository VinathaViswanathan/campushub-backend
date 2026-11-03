import type { Reservation } from '../api/types';
import { localDateKey } from './datetime';

export interface DayGroup {
  /** Local calendar day, "YYYY-MM-DD". */
  key: string;
  /** Start time of the first booking that day, used for the date tile. */
  firstStart: string;
  items: Reservation[];
}

/** Groups reservations (already sorted by startTime) into consecutive local days. */
export function groupByDay(reservations: Reservation[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const reservation of reservations) {
    const key = localDateKey(reservation.startTime);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(reservation);
    } else {
      groups.push({ key, firstStart: reservation.startTime, items: [reservation] });
    }
  }
  return groups;
}
