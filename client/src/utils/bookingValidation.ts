import { combineDateTime } from './datetime';

export interface BookingFieldErrors {
  date?: string;
  startTime?: string;
  endTime?: string;
  userId?: string;
}

export interface BookingDraft {
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
}

/** Client-side checks that run before any request is sent. Pure: no React, no API. */
export function validateBooking({ userId, date, startTime, endTime }: BookingDraft): BookingFieldErrors {
  const errors: BookingFieldErrors = {};
  if (userId.trim() === '') errors.userId = 'Enter your student ID at the top of the page.';
  if (date === '') errors.date = 'Choose a date.';
  if (startTime === '') errors.startTime = 'Choose a start time.';
  if (endTime === '') errors.endTime = 'Choose an end time.';

  const start = combineDateTime(date, startTime);
  const end = combineDateTime(date, endTime);
  if (start && start.getTime() <= Date.now()) errors.startTime = 'Start time must be in the future.';
  if (start && end && end.getTime() <= start.getTime()) {
    errors.endTime = 'End time must be after the start time.';
  }
  return errors;
}
