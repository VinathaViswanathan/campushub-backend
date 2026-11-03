import { fetchResources } from '../api/campushubApi';
import type { Resource, ResourceType } from '../api/types';
import { useApiQuery } from './useApiQuery';

export interface UseResourcesResult {
  resources: Resource[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

const NO_RESOURCES: Resource[] = [];

/** GET /resources for the given filters; re-fetches whenever they change. */
export function useResources(
  type: ResourceType | undefined,
  availableOnly: boolean,
): UseResourcesResult {
  const { data, isLoading, error, reload } = useApiQuery(
    `${type ?? 'ALL'}:${availableOnly}`,
    (signal) => fetchResources(type, { isAvailable: availableOnly ? true : undefined, signal }),
    NO_RESOURCES,
  );
  return { resources: data, isLoading, error, reload };
}
