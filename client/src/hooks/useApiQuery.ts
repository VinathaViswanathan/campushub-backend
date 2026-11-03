import { useCallback, useEffect, useRef, useState } from 'react';
import { isAbortError } from '../api/campushubApi';
import { toUserMessage } from '../utils/errorMessages';

export interface ApiQueryResult<T> {
  data: T;
  isLoading: boolean;
  /** User-facing message, already mapped from the API error code. */
  error: string | null;
  reload: () => void;
}

/**
 * The one place that implements fetch-on-change for the client: loading state, error
 * mapping, and aborting stale requests. Re-fetches whenever `key` changes or reload()
 * is called. `load` may be a new function each render; the latest one is used.
 */
export function useApiQuery<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  initialData: T,
): ApiQueryResult<T> {
  const [data, setData] = useState<T>(initialData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const loadRef = useRef(load);
  const initialDataRef = useRef(initialData);

  // Declared before the fetch effect so it runs first and the fetch sees the latest loader.
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    // Aborting on cleanup stops a slow, stale response from overwriting newer results.
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    loadRef
      .current(controller.signal)
      .then((result) => setData(result))
      .catch((err: unknown) => {
        if (isAbortError(err)) return;
        setData(initialDataRef.current);
        setError(toUserMessage(err));
      })
      .finally(() => {
        // Always clear the indicator for the request that is still current.
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [key, reloadToken]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  return { data, isLoading, error, reload };
}
