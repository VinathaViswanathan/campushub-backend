import { useState, type FormEvent } from 'react';
import type { Reservation, Resource } from '../api/types';
import { validateBooking, type BookingFieldErrors } from '../utils/bookingValidation';
import { addMinutesToTime, combineDateTime, tomorrowAsDateInput } from '../utils/datetime';
import { useCreateReservation } from './useReservations';

export type TimeField = 'date' | 'startTime' | 'endTime';

export interface UseBookingFormResult {
  values: Record<TimeField, string>;
  setField: (field: TimeField, value: string) => void;
  applyDuration: (minutes: number) => void;
  /** Length of the chosen slot, or null until start and end form a valid range. */
  durationMinutes: number | null;
  fieldErrors: BookingFieldErrors;
  /** The reservation just created, shown as a confirmation until the next edit. */
  confirmation: Reservation | null;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

/** Booking form state: field values, validation, submit, and the API result. No JSX. */
export function useBookingForm(
  resource: Resource,
  userId: string,
  onBooked: (reservation: Reservation) => void,
): UseBookingFormResult {
  const [values, setValues] = useState<Record<TimeField, string>>({
    date: tomorrowAsDateInput(),
    startTime: '',
    endTime: '',
  });
  const [fieldErrors, setFieldErrors] = useState<BookingFieldErrors>({});
  const [confirmation, setConfirmation] = useState<Reservation | null>(null);
  const { submit, isSubmitting, error, clearError } = useCreateReservation();

  const start = combineDateTime(values.date, values.startTime);
  const end = combineDateTime(values.date, values.endTime);
  const durationMinutes =
    start && end && end > start ? Math.round((end.getTime() - start.getTime()) / 60_000) : null;

  /** Updating a field clears its error, the last confirmation, and any API error. */
  function setField(field: TimeField, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setConfirmation(null);
    clearError();
  }

  function applyDuration(minutes: number) {
    const next = addMinutesToTime(values.startTime, minutes);
    if (next !== null) setField('endTime', next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConfirmation(null);
    const errors = validateBooking({ userId, ...values });
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
      setValues((prev) => ({ ...prev, startTime: '', endTime: '' }));
      onBooked(created);
    }
    // On failure the hook sets `error`; the chosen times stay so the student can adjust them.
  }

  return {
    values,
    setField,
    applyDuration,
    durationMinutes,
    fieldErrors,
    confirmation,
    isSubmitting,
    error,
    clearError,
    handleSubmit,
  };
}
