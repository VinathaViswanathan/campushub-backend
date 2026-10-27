import { useCallback, useState } from 'react';
import { createReservation } from '../api/campushubApi';
import type { CreateReservationDTO, Reservation } from '../api/types';
import { toUserMessage } from '../utils/errorMessages';

export interface UseCreateReservationResult {
  /** Resolves with the new reservation, or null if the request failed (see `error`). */
  submit: (payload: CreateReservationDTO) => Promise<Reservation | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

/** Wraps POST /reservations with loading and error state. */
export function useCreateReservation(): UseCreateReservationResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (payload: CreateReservationDTO) => {
    setIsSubmitting(true);
    setError(null);
    try {
      return await createReservation(payload);
    } catch (err) {
      setError(toUserMessage(err));
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { submit, isSubmitting, error, clearError };
}
