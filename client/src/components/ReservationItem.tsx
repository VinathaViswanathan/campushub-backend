import type { Reservation } from '../api/types';
import { formatTime } from '../utils/datetime';
import styles from './ReservationItem.module.css';

export interface ReservationItemProps {
  reservation: Reservation;
  resourceName: string;
  /** Shows the inline "Cancel this booking?" confirmation instead of the Cancel link. */
  isConfirming: boolean;
  /** This booking's cancel request is in flight. */
  isCancelling: boolean;
  /** Another booking is being cancelled, so this Cancel link is disabled. */
  cancelDisabled: boolean;
  onRequestCancel: () => void;
  onKeep: () => void;
  onConfirmCancel: () => void;
}

const STATUS_LABELS: Record<Reservation['status'], string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
};

/** One booking in the agenda: time, resource, status, and the two-step cancel action. */
export function ReservationItem({
  reservation,
  resourceName,
  isConfirming,
  isCancelling,
  cancelDisabled,
  onRequestCancel,
  onKeep,
  onConfirmCancel,
}: ReservationItemProps) {
  return (
    <li className={styles.item}>
      <div className={styles.itemMain}>
        <span className={styles.time}>
          {formatTime(reservation.startTime)} – {formatTime(reservation.endTime)}
        </span>
        <span className={styles.name}>{resourceName}</span>
        <span className={styles.status} data-status={reservation.status}>
          {STATUS_LABELS[reservation.status]}
        </span>
      </div>

      {isConfirming ? (
        <div className={styles.confirm}>
          <span>Cancel this booking?</span>
          <button type="button" className={styles.keep} onClick={onKeep} disabled={isCancelling}>
            Keep it
          </button>
          <button type="button" className={styles.danger} onClick={onConfirmCancel} disabled={isCancelling}>
            {isCancelling ? 'Cancelling…' : 'Cancel booking'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={styles.cancel}
          onClick={onRequestCancel}
          disabled={cancelDisabled}
          aria-label={`Cancel reservation for ${resourceName}`}
        >
          Cancel
        </button>
      )}
    </li>
  );
}
