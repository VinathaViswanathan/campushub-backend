/**
 * Per-resource lock: runs async tasks for the same key one at a time, in arrival order.
 *
 * Why: createReservation checks for an overlap and then inserts. Without serialization,
 * two simultaneous requests can both pass the check and both insert (a double booking).
 * Tasks for different keys still run in parallel.
 *
 * Scope: one Node process (how CampusHub is deployed). Several server instances would
 * need a database-level guarantee instead, such as a MongoDB transaction.
 */

const tails = new Map<string, Promise<void>>();

export async function withResourceLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  tails.set(key, tail);

  await previous;
  try {
    return await task();
  } finally {
    release();
    if (tails.get(key) === tail) tails.delete(key); // nothing queued behind us
  }
}
