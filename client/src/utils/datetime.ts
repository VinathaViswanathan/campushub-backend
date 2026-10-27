/**
 * Date/time helpers. The booking form collects a local date ("YYYY-MM-DD") and local
 * times ("HH:mm"); the API requires RFC 3339 with a timezone, so we convert to UTC ISO.
 */

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Today's local date as "YYYY-MM-DD", for <input type="date">. */
export function todayAsDateInput(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Tomorrow's local date as "YYYY-MM-DD" (the form's default). */
export function tomorrowAsDateInput(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Combines a local date and time into a Date; null when either is empty or invalid. */
export function combineDateTime(date: string, time: string): Date | null {
  if (date === '' || time === '') return null;
  const value = new Date(`${date}T${time}`);
  return Number.isNaN(value.getTime()) ? null : value;
}

/** "HH:mm" plus minutes, or null if the result would pass midnight. */
export function addMinutesToTime(time: string, minutes: number): string | null {
  const [h, m] = time.split(':').map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return null;
  const total = h * 60 + m + minutes;
  if (total >= 24 * 60) return null;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** 90 -> "1 h 30 min", 60 -> "1 h", 30 -> "30 min". */
export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const longDateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

/** "Tue, Dec 1" */
export function formatLongDate(iso: string): string {
  return longDateFormatter.format(new Date(iso));
}

/** Local calendar day of an ISO timestamp, used to group bookings by day. */
export function localDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Pieces for the agenda's date block: weekday "Tue", day "1", month "Dec". */
export function dateBlockParts(iso: string): { weekday: string; day: string; month: string } {
  const d = new Date(iso);
  return {
    weekday: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(d),
    day: String(d.getDate()),
    month: new Intl.DateTimeFormat(undefined, { month: 'short' }).format(d),
  };
}
