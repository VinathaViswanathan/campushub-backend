import { useState, type FormEvent } from 'react';
import type { Resource } from './api/types';
import { BookingForm } from './components/BookingForm';
import { ResourceList } from './components/ResourceList';
import { UserReservations } from './components/UserReservations';
import styles from './App.module.css';

/** The API has no authentication yet, so the student identifies themselves by ID. */
const DEFAULT_USER_ID = 'user-456';

export default function App() {
  const [userId, setUserId] = useState(DEFAULT_USER_ID);
  const [userIdDraft, setUserIdDraft] = useState(DEFAULT_USER_ID);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  // Bumped after each successful booking so "My bookings" re-fetches.
  const [bookingsRefreshKey, setBookingsRefreshKey] = useState(0);

  function handleUserSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = userIdDraft.trim();
    if (next !== '') setUserId(next);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <span className={styles.wordmark}>CampusHub</span>
          <form className={styles.userForm} onSubmit={handleUserSubmit}>
            <label htmlFor="student-id">Student ID</label>
            <input
              id="student-id"
              value={userIdDraft}
              onChange={(event) => setUserIdDraft(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" disabled={userIdDraft.trim() === '' || userIdDraft.trim() === userId}>
              Switch
            </button>
          </form>
        </div>
      </header>

      <main className={styles.layout}>
        <ResourceList
          selectedResourceId={selectedResource?.id ?? null}
          onSelect={setSelectedResource}
        />

        <div className={styles.sideColumn}>
          {selectedResource ? (
            <BookingForm
              key={selectedResource.id}
              resource={selectedResource}
              userId={userId}
              onBooked={() => setBookingsRefreshKey((n) => n + 1)}
              onClose={() => setSelectedResource(null)}
            />
          ) : (
            <section className={styles.placeholder} aria-label="Booking">
              <h2 className={styles.placeholderTitle}>Choose what to book</h2>
              <p className={styles.placeholderText}>
                Select a room, lab, or piece of equipment from the list, then pick a date and time.
              </p>
            </section>
          )}
          <UserReservations userId={userId} refreshKey={bookingsRefreshKey} />
        </div>
      </main>
    </div>
  );
}
