import { ApiError } from '../api/campushubApi';

/** Turns any thrown value into a sentence a student can act on. */
export function toUserMessage(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }
  switch (err.code) {
    case 'DOUBLE_BOOKING':
      return 'This resource is already reserved for the selected time window. Please choose a different time.';
    case 'RESOURCE_UNAVAILABLE':
      return 'This resource is currently unavailable and cannot be booked.';
    case 'RESOURCE_NOT_FOUND':
      return 'This resource no longer exists. Refresh the resource list and try again.';
    case 'RESERVATION_NOT_FOUND':
      return 'This reservation no longer exists.';
    case 'VALIDATION_ERROR':
      return err.message;
    case 'NETWORK_ERROR':
      return 'Cannot reach the CampusHub server. Make sure the backend is running, then try again.';
    default:
      return 'The server ran into a problem. Please try again in a moment.';
  }
}
