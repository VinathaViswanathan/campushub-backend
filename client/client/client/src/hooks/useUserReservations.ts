import { useCallback, useEffect, useState } from 'react';
import {
  cancelReservation,
  fetchResources,
  fetchUserReservations,
  isAbortError,
} from '../api/campushubApi';
import type { Reservation } from '../api/types';
import { toUserMessage } from '../utils/errorMessages';

export interface UseUserReservationsResult {
  reservations: Reservation[];
  /** resourceId -> resource name, so the dashboard can show names instead of ObjectIds. */
  resourceNames: Record<string, string>;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
  cancel: (reservationId: string) => Promise<void>;
  /** The reservation currently being cancelled, if any. */
  cancellingId: string | null;
  cancelError: string | null;
}

/**
 * Loads GET /reservations/user/{userId} and exposes the cancel action.
 * Re-fetches when userId or refreshKey changes (the parent bumps refreshKey after a booking).
 */
export function useUserReservations(userId: string, refreshKey: number): UseUserReservationsResult {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [resourceNames, setResourceNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    Promise.all([
      fetchUserReservations(userId, { signal: controller.signal }),
      fetchResources(undefined, { signal: controller.signal }),
    ])
      .then(([userReservations, resources]) => {
        setReservations(userReservations);
        setResourceNames(Object.fromEntries(resources.map((r) => [r.id, r.name])));
      })
      .catch((err: unknown) => {
        if (isAbortError(err)) return;
        setReservations([]);
        setError(toUserMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [userId, refreshKey, reloadToken]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

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
        // Refresh either way: on success the cancelled booking disappears; on
        // RESERVATION_NOT_FOUND the list catches up with the server.
        reload();
      }
    },
    [reload],
  );

  return {
    reservations,
    resourceNames,
    isLoading,
    error,
    reload,
    cancel,
    cancellingId,
    cancelError,
  };
}
