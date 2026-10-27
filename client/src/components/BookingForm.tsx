import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Reservation, Resource } from '../api/types';
import { useCreateReservation } from '../hooks/useCreateReservation';
import {
  addMinutesToTime,
  combineDateTime,
  formatDuration,
  formatLongDate,
  formatTime,
  todayAsDateInput,
  tomorrowAsDateInput,
} from '../utils/datetime';
import { ErrorBanner } from './ErrorBanner';
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

interface FieldErrors {
  date?: string;
  startTime?: string;
  endTime?: string;
  userId?: string;
}

const QUICK_DURATIONS = [
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
];

/** Client-side checks that run before any request is sent. */
function validate(userId: string, date: string, startTime: string, endTime: string): FieldErrors {
  const errors: FieldErrors = {};
  if (userId.trim() === '') errors.userId = 'Enter your student ID at the top of the page.';
  if (date === '') errors.date = 'Choose a date.';
  if (startTime === '') errors.startTime = 'Choose a start time.';
  if (endTime === '') errors.endTime = 'Choose an end time.';

  const start = combineDateTime(date, startTime);
  const end = combineDateTime(date, endTime);
  if (start && start.getTime() <= Date.now()) {
    errors.startTime = 'Start time must be in the future.';
  }
  if (start && end && end.getTime() <= start.getTime()) {
    errors.endTime = 'End time must be after the start time.';
  }
  return errors;
}

/** Booking panel for one resource: date and times, validation, submit, API errors. */
export function BookingForm({ resource, userId, onBooked, onClose }: BookingFormProps) {
  const [date, setDate] = useState(tomorrowAsDateInput);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [confirmation, setConfirmation] = useState<Reservation | null>(null);
  const { submit, isSubmitting, error, clearError } = useCreateReservation();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // On a single-column (phone) layout the panel opens below the list, so bring it into
  // view and move focus to its heading; on desktop it is already beside the list.
  useEffect(() => {
    if (!window.matchMedia('(max-width: 56rem)').matches) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    headingRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const start = combineDateTime(date, startTime);
  const end = combineDateTime(date, endTime);
  const durationMinutes =
    start && end && end > start ? Math.round((end.getTime() - start.getTime()) / 60_000) : null;

  function edited(field: keyof FieldErrors) {
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setConfirmation(null);
    clearError();
  }

  function applyDuration(minutes: number) {
    const next = addMinutesToTime(startTime, minutes);
    if (next === null) return;
    setEndTime(next);
    edited('endTime');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConfirmation(null);

    const errors = validate(userId, date, startTime, endTime);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || !start || !end) return;

    const created = await submit({
      resourceId: resource.id,
      userId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    });
    if (created) {
      setConfirmation(created);
      setStartTime('');
      setEndTime('');
      onBooked(created);
    }
    // On failure the hook sets `error`; the chosen times stay so the student can adjust them.
  }

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

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor="booking-date">Date</label>
          <input
            id="booking-date"
            type="date"
            value={date}
            min={todayAsDateInput()}
            onChange={(event) => {
              setDate(event.target.value);
              edited('date');
            }}
            aria-invalid={fieldErrors.date !== undefined}
            aria-describedby={fieldErrors.date ? 'booking-date-error' : undefined}
            disabled={isSubmitting}
          />
          {fieldErrors.date && (
            <p id="booking-date-error" className={styles.fieldError}>
              {fieldErrors.date}
            </p>
          )}
        </div>

        <div className={styles.timeRow}>
          <div className={styles.field}>
            <label htmlFor="booking-start">Start time</label>
            <input
              id="booking-start"
              type="time"
              step={900}
              value={startTime}
              onChange={(event) => {
                setStartTime(event.target.value);
                edited('startTime');
              }}
              aria-invalid={fieldErrors.startTime !== undefined}
              aria-describedby={fieldErrors.startTime ? 'booking-start-error' : undefined}
              disabled={isSubmitting}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="booking-end">End time</label>
            <input
              id="booking-end"
              type="time"
              step={900}
              value={endTime}
              onChange={(event) => {
                setEndTime(event.target.value);
                edited('endTime');
              }}
              aria-invalid={fieldErrors.endTime !== undefined}
              aria-describedby={fieldErrors.endTime ? 'booking-end-error' : undefined}
              disabled={isSubmitting}
            />
          </div>
        </div>
        {fieldErrors.startTime && (
          <p id="booking-start-error" className={styles.fieldError}>
            {fieldErrors.startTime}
          </p>
        )}
        {fieldErrors.endTime && (
          <p id="booking-end-error" className={styles.fieldError}>
            {fieldErrors.endTime}
          </p>
        )}

        <div className={styles.quick} role="group" aria-label="Set length">
          {QUICK_DURATIONS.map((option) => (
            <button
              key={option.minutes}
              type="button"
              className={styles.quickButton}
              aria-pressed={durationMinutes === option.minutes}
              disabled={
                isSubmitting ||
                startTime === '' ||
                addMinutesToTime(startTime, option.minutes) === null
              }
              onClick={() => applyDuration(option.minutes)}
            >
              {option.label}
            </button>
          ))}
          <span className={styles.duration} aria-live="polite">
            {durationMinutes !== null ? formatDuration(durationMinutes) : 'Pick a start time'}
          </span>
        </div>

        {fieldErrors.userId && <p className={styles.fieldError}>{fieldErrors.userId}</p>}

        {error && <ErrorBanner message={error} onDismiss={clearError} />}

        {confirmation && (
          <p className={styles.success} role="status">
            Booked for {formatLongDate(confirmation.startTime)},{' '}
            {formatTime(confirmation.startTime)} – {formatTime(confirmation.endTime)}. It shows as
            pending in My bookings.
          </p>
        )}

        <button type="submit" className={styles.submit} disabled={isSubmitting}>
          {isSubmitting ? 'Booking…' : 'Book this time'}
        </button>
      </form>
    </section>
  );
}
