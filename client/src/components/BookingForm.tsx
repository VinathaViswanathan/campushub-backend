import type { Reservation, Resource } from '../api/types';
import { useBookingForm } from '../hooks/useBookingForm';
import { useRevealOnNarrowScreen } from '../hooks/useRevealOnNarrowScreen';
import { formatLongDate, formatTime, todayAsDateInput } from '../utils/datetime';
import { DurationPicker } from './DurationPicker';
import { ErrorBanner } from './ErrorBanner';
import { FormField } from './FormField';
import styles from './BookingForm.module.css';

export interface BookingFormProps {
  /** The resource being booked (the parent keys this component by resource.id). */
  resource: Resource;
  /** The current student's ID. */
  userId: string;
  /** Called after the API returns 201 so the parent can refresh "My bookings". */
  onBooked: (reservation: Reservation) => void;
  /** Closes the panel. */
  onClose: () => void;
}

/** Booking panel for one resource. Rendering only: state and logic live in useBookingForm. */
export function BookingForm({ resource, userId, onBooked, onClose }: BookingFormProps) {
  const form = useBookingForm(resource, userId, onBooked);
  const headingRef = useRevealOnNarrowScreen<HTMLHeadingElement>();
  const { values, fieldErrors, isSubmitting, confirmation } = form;

  return (
    <section className={styles.panel} aria-labelledby="booking-heading">
      <div className={styles.header}>
        <div>
          <h2 id="booking-heading" className={styles.title} ref={headingRef} tabIndex={-1}>
            {resource.name}
          </h2>
          <p className={styles.location}>{resource.location}</p>
        </div>
        <button type="button" className={styles.close} onClick={onClose}>
          Close
        </button>
      </div>

      <form className={styles.form} onSubmit={form.handleSubmit} noValidate>
        <FormField
          id="booking-date"
          label="Date"
          type="date"
          value={values.date}
          min={todayAsDateInput()}
          onChange={(value) => form.setField('date', value)}
          error={fieldErrors.date}
          disabled={isSubmitting}
        />
        <div className={styles.timeRow}>
          <FormField
            id="booking-start"
            label="Start time"
            type="time"
            step={900}
            value={values.startTime}
            onChange={(value) => form.setField('startTime', value)}
            error={fieldErrors.startTime}
            disabled={isSubmitting}
          />
          <FormField
            id="booking-end"
            label="End time"
            type="time"
            step={900}
            value={values.endTime}
            onChange={(value) => form.setField('endTime', value)}
            error={fieldErrors.endTime}
            disabled={isSubmitting}
          />
        </div>

        <DurationPicker
          startTime={values.startTime}
          durationMinutes={form.durationMinutes}
          onPick={form.applyDuration}
          disabled={isSubmitting}
        />

        {fieldErrors.userId && <p className={styles.formError}>{fieldErrors.userId}</p>}
        {form.error && <ErrorBanner message={form.error} onDismiss={form.clearError} />}
        {confirmation && (
          <p className={styles.success} role="status">
            Booked for {formatLongDate(confirmation.startTime)}, {formatTime(confirmation.startTime)} –{' '}
            {formatTime(confirmation.endTime)}. It shows as pending in My bookings.
          </p>
        )}

        <button type="submit" className={styles.submit} disabled={isSubmitting}>
          {isSubmitting ? 'Booking…' : 'Book this time'}
        </button>
      </form>
    </section>
  );
}
