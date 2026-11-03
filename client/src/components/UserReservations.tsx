import { useState } from 'react';
import { useUserReservations } from '../hooks/useReservations';
import { groupByDay } from '../utils/agenda';
import { dateBlockParts } from '../utils/datetime';
import { ErrorBanner } from './ErrorBanner';
import { ReservationItem } from './ReservationItem';
import styles from './UserReservations.module.css';

export interface UserReservationsProps {
  /** The student whose active reservations are listed. */
  userId: string;
  /** Bumped by the parent after a successful booking so this list re-fetches. */
  refreshKey: number;
}

/** "My bookings": the student's PENDING/CONFIRMED reservations as a day-by-day agenda. */
export function UserReservations({ userId, refreshKey }: UserReservationsProps) {
  const { reservations, resourceNames, isLoading, error, reload, cancel, cancellingId, cancelError } =
    useUserReservations(userId, refreshKey);
  // Only one booking shows the "Cancel this booking?" confirmation at a time.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  async function confirmCancel(reservationId: string) {
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
                  {day.items.map((reservation) => (
                    <ReservationItem
                      key={reservation.id}
                      reservation={reservation}
                      resourceName={resourceNames[reservation.resourceId] ?? 'Unknown resource'}
                      isConfirming={confirmingId === reservation.id}
                      isCancelling={cancellingId === reservation.id}
                      cancelDisabled={cancellingId !== null}
                      onRequestCancel={() => setConfirmingId(reservation.id)}
                      onKeep={() => setConfirmingId(null)}
                      onConfirmCancel={() => void confirmCancel(reservation.id)}
                    />
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
