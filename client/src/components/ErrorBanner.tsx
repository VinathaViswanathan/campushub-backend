import styles from './ErrorBanner.module.css';

export interface ErrorBannerProps {
  message: string;
  /** Shows a "Try again" button when provided. */
  onRetry?: () => void;
  /** Shows a dismiss button when provided. */
  onDismiss?: () => void;
}

/** An explicit, screen-reader-announced error alert used by every async workflow. */
export function ErrorBanner({ message, onRetry, onDismiss }: ErrorBannerProps) {
  return (
    <div className={styles.banner} role="alert">
      <p className={styles.message}>{message}</p>
      <div className={styles.actions}>
        {onRetry && (
          <button type="button" className={styles.button} onClick={onRetry}>
            Try again
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            className={styles.button}
            onClick={onDismiss}
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
