import { addMinutesToTime, formatDuration } from '../utils/datetime';
import styles from './DurationPicker.module.css';

export interface DurationPickerProps {
  /** Start time ("HH:mm"); the buttons stay disabled until it is set. */
  startTime: string;
  /** The current slot length, or null when start/end do not form a valid range. */
  durationMinutes: number | null;
  onPick: (minutes: number) => void;
  disabled?: boolean;
}

const QUICK_DURATIONS = [
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
];

/** Quick length buttons that set the end time, plus a live duration readout. */
export function DurationPicker({ startTime, durationMinutes, onPick, disabled }: DurationPickerProps) {
  return (
    <div className={styles.quick} role="group" aria-label="Set length">
      {QUICK_DURATIONS.map((option) => (
        <button
          key={option.minutes}
          type="button"
          className={styles.quickButton}
          aria-pressed={durationMinutes === option.minutes}
          disabled={disabled || startTime === '' || addMinutesToTime(startTime, option.minutes) === null}
          onClick={() => onPick(option.minutes)}
        >
          {option.label}
        </button>
      ))}
      <span className={styles.duration} aria-live="polite">
        {durationMinutes !== null ? formatDuration(durationMinutes) : 'Pick a start time'}
      </span>
    </div>
  );
}
