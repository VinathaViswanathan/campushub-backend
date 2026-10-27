import { useState } from 'react';
import { RESOURCE_TYPES, type Resource, type ResourceType } from '../api/types';
import { useResources } from '../hooks/useResources';
import { ErrorBanner } from './ErrorBanner';
import styles from './ResourceList.module.css';

export interface ResourceListProps {
  /** Highlights the row whose booking panel is open. */
  selectedResourceId: string | null;
  /** Called when the student picks an available resource. */
  onSelect: (resource: Resource) => void;
}

interface FilterOption {
  label: string;
  value: ResourceType | undefined;
}

const FILTERS: FilterOption[] = [
  { label: 'All', value: undefined },
  { label: 'Study rooms', value: 'ROOM' },
  { label: 'Equipment', value: 'EQUIPMENT' },
  { label: 'Labs', value: 'LAB' },
];

const GROUP_TITLES: Record<ResourceType, string> = {
  ROOM: 'Study rooms',
  EQUIPMENT: 'Equipment',
  LAB: 'Labs',
};

/** Resource directory: type and availability filters, rows grouped by resource type. */
export function ResourceList({ selectedResourceId, onSelect }: ResourceListProps) {
  const [type, setType] = useState<ResourceType | undefined>(undefined);
  const [availableOnly, setAvailableOnly] = useState(false);
  const { resources, isLoading, error, reload } = useResources(type, availableOnly);

  const groups = RESOURCE_TYPES.map((groupType) => ({
    type: groupType,
    items: resources.filter((r) => r.type === groupType),
  })).filter((group) => group.items.length > 0);

  const countLabel = `${resources.length} ${resources.length === 1 ? 'resource' : 'resources'}`;

  return (
    <section className={styles.directory} aria-labelledby="directory-heading">
      <div className={styles.heading}>
        <h1 id="directory-heading">Rooms, labs, and equipment</h1>
        {!isLoading && !error && <p className={styles.count}>{countLabel}</p>}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.segmented} role="group" aria-label="Filter by type">
          {FILTERS.map((filter) => (
            <button
              key={filter.label}
              type="button"
              className={styles.segment}
              aria-pressed={type === filter.value}
              onClick={() => setType(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(event) => setAvailableOnly(event.target.checked)}
          />
          Available only
        </label>
      </div>

      {error && <ErrorBanner message={error} onRetry={reload} />}

      {isLoading && (
        <p className={styles.notice} role="status">
          Loading resources…
        </p>
      )}

      {!isLoading && !error && resources.length === 0 && (
        <p className={styles.notice}>
          Nothing matches these filters. Try another type or turn off “Available only”.
        </p>
      )}

      {!isLoading &&
        !error &&
        groups.map((group) => (
          <div key={group.type} className={styles.group}>
            {type === undefined && <h2 className={styles.groupTitle}>{GROUP_TITLES[group.type]}</h2>}
            <ul className={styles.rows}>
              {group.items.map((resource) => {
                const isSelected = resource.id === selectedResourceId;
                return (
                  <li key={resource.id}>
                    <button
                      type="button"
                      className={styles.row}
                      aria-pressed={isSelected}
                      aria-label={
                        resource.isAvailable
                          ? `Book ${resource.name}`
                          : `${resource.name} is not available`
                      }
                      disabled={!resource.isAvailable}
                      onClick={() => onSelect(resource)}
                    >
                      <span className={styles.rowMain}>
                        <span className={styles.rowName}>{resource.name}</span>
                        <span className={styles.rowLocation}>{resource.location}</span>
                      </span>
                      <span
                        className={resource.isAvailable ? styles.rowAction : styles.rowUnavailable}
                      >
                        {resource.isAvailable ? (isSelected ? 'Selected' : 'Book') : 'Not available'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
    </section>
  );
}
