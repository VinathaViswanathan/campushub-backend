import { useCallback, useState } from 'react';
import {
  cancelReservation,
  createReservation,
  fetchResources,
  fetchUserReservations,
} from '../api/campushubApi';
import type { CreateReservationRequest, Reservation } from '../api/types';
import { toUserMessage } from '../utils/errorMessages';
import { useApiQuery } from './useApiQuery';

/** All reservation API state for the UI: the student's bookings, cancelling, and creating. */

interface UserReservationsData {
  reservations: Reservation[];
  /** resourceId -> resource name, so the agenda shows names instead of ObjectIds. */
  resourceNames: Record<string, string>;
}

const NO_RESERVATIONS: UserReservationsData = { reservations: [], resourceNames: {} };

export interface UseUserReservationsResult extends UserReservationsData {
  isLoading: boolean;
  error: string | null;
  reload: () => void;
  cancel: (reservationId: string) => Promise<void>;
  /** The reservation currently being cancelled, if any. */
  cancellingId: string | null;
  cancelError: string | null;
}

/**
 * GET /reservations/user/{userId} plus the cancel action. Re-fetches when userId or
 * refreshKey changes (the parent bumps refreshKey after a booking).
 */
export function useUserReservations(userId: string, refreshKey: number): UseUserReservationsResult {
  const { data, isLoading, error, reload } = useApiQuery(
    `${userId}:${refreshKey}`,
    async (signal) => {
      const [reservations, resources] = await Promise.all([
        fetchUserReservations(userId, { signal }),
        fetchResources(undefined, { signal }),
      ]);
      return { reservations, resourceNames: Object.fromEntries(resources.map((r) => [r.id, r.name])) };
    },
    NO_RESERVATIONS,
  );
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const cancel = useCallback(
    async (reservationId: string) => {
      setCancellingId(reservationId);
      setCancelError(null);
      try {
        await cancelReservation(reservationId);
      } catch (err) {
        setCancelError(toUserMessage(err));
      } finally {
        setCancellingId(null);
        // Refresh either way: on success the booking disappears; on RESERVATION_NOT_FOUND
        // the list catches up with the server.
        reload();
      }
    },
    [reload],
  );

  return { ...data, isLoading, error, reload, cancel, cancellingId, cancelError };
}

export interface UseCreateReservationResult {
  /** Resolves with the new reservation, or null if the request failed (see `error`). */
  submit: (payload: CreateReservationRequest) => Promise<Reservation | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

/** POST /reservations with submitting and error state. */
export function useCreateReservation(): UseCreateReservationResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (payload: CreateReservationRequest) => {
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
