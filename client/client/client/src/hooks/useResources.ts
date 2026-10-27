import { useCallback, useEffect, useState } from 'react';
import { fetchResources, isAbortError } from '../api/campushubApi';
import type { Resource, ResourceType } from '../api/types';
import { toUserMessage } from '../utils/errorMessages';

export interface UseResourcesResult {
  resources: Resource[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

/** Loads GET /resources for the given filters; re-fetches whenever they change. */
export function useResources(
  type: ResourceType | undefined,
  availableOnly: boolean,
): UseResourcesResult {
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    // Aborting on cleanup stops a slow, stale response from overwriting a newer filter's results.
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetchResources(type, {
      isAvailable: availableOnly ? true : undefined,
      signal: controller.signal,
    })
      .then((data) => {
        setResources(data);
      })
      .catch((err: unknown) => {
        if (isAbortError(err)) return;
        setResources([]);
        setError(toUserMessage(err));
      })
      .finally(() => {
        // Always clear the spinner for the request that is still current.
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [type, availableOnly, reloadToken]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  return { resources, isLoading, error, reload };
}
