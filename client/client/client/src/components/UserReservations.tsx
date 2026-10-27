import { useState } from 'react';
import type { Reservation } from '../api/types';
import { useUserReservations } from '../hooks/useUserReservations';
import { dateBlockParts, formatTime, localDateKey } from '../utils/datetime';
import { ErrorBanner } from './ErrorBanner';
import styles from './UserReservations.module.css';

export interface UserReservationsProps {
  /** The student whose active reservations are listed. */
  userId: string;
  /** Bumped by the parent after a successful booking so this list re-fetches. */
  refreshKey: number;
}

interface DayGroup {
  key: string;
  firstStart: string;
  items: Reservation[];
}

/** Reservations arrive sorted by startTime, so consecutive items share a day. */
function groupByDay(reservations: Reservation[]): DayGroup[] {
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

const STATUS_LABELS: Record<Reservation['status'], string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
};

/** "My bookings": the student's PENDING/CONFIRMED reservations as a day-by-day agenda. */
export function UserReservations({ userId, refreshKey }: UserReservationsProps) {
  const { reservations, resourceNames, isLoading, error, reload, cancel, cancellingId, cancelError } =
    useUserReservations(userId, refreshKey);
  // Which booking is showing the "Cancel this booking?" confirmation.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  async function handleConfirmCancel(reservationId: string) {
    await cancel(reservationId);
    setConfirmingId(null);
  }

  const days = groupByDay(reservations);

  return (
    <section className={styles.panel} aria-labelledby="my-bookings-heading">
      <div className={styles.header}>
        <h2 id="my-bookings-heading" className={styles.title}>
          My bookings
        </h2>
        <button type="button" className={styles.refresh} onClick={reload} disabled={isLoading}>
          Refresh
        </button>
      </div>
      <p className={styles.subtitle}>Active bookings for {userId}</p>

      {error && <ErrorBanner message={error} onRetry={reload} />}
      {cancelError && <ErrorBanner message={cancelError} />}

      {isLoading && (
        <p className={styles.notice} role="status">
          Loading your bookings…
        </p>
      )}

      {!isLoading && !error && reservations.length === 0 && (
        <p className={styles.notice}>You have no active reservations. Choose something from the list to book it.</p>
      )}

      {!isLoading && !error && days.length > 0 && (
        <ol className={styles.days}>
          {days.map((day) => {
            const parts = dateBlockParts(day.firstStart);
            return (
              <li key={day.key} className={styles.day}>
                <div className={styles.dateBlock} aria-hidden="true">
                  <span className={styles.weekday}>{parts.weekday}</span>
                  <span className={styles.dayNumber}>{parts.day}</span>
                  <span className={styles.month}>{parts.month}</span>
                </div>
                <ul className={styles.items}>
                  {day.items.map((reservation) => {
                    const name = resourceNames[reservation.resourceId] ?? 'Unknown resource';
                    const isConfirming = confirmingId === reservation.id;
                    const isCancelling = cancellingId === reservation.id;
                    return (
                      <li key={reservation.id} className={styles.item}>
                        <div className={styles.itemMain}>
                          <span className={styles.time}>
                            {formatTime(reservation.startTime)} – {formatTime(reservation.endTime)}
                          </span>
                          <span className={styles.name}>{name}</span>
                          <span className={styles.status} data-status={reservation.status}>
                            {STATUS_LABELS[reservation.status]}
                          </span>
                        </div>

                        {isConfirming ? (
                          <div className={styles.confirm}>
                            <span>Cancel this booking?</span>
                            <button
                              type="button"
                              className={styles.keep}
                              onClick={() => setConfirmingId(null)}
                              disabled={isCancelling}
                            >
                              Keep it
                            </button>
                            <button
                              type="button"
                              className={styles.danger}
                              onClick={() => void handleConfirmCancel(reservation.id)}
                              disabled={isCancelling}
                            >
                              {isCancelling ? 'Cancelling…' : 'Cancel booking'}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={styles.cancel}
                            onClick={() => setConfirmingId(reservation.id)}
                            disabled={cancellingId !== null}
                            aria-label={`Cancel reservation for ${name}`}
                          >
                            Cancel
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
