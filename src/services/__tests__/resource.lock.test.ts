import { describe, expect, it } from '@jest/globals';
import { withResourceLock } from '../resource.lock';

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('withResourceLock', () => {
  it('runs tasks for the same key one at a time, in arrival order', async () => {
    const log: string[] = [];
    const task = (name: string, ms: number) => async (): Promise<string> => {
      log.push(`${name}:start`);
      await delay(ms);
      log.push(`${name}:end`);
      return name;
    };

    const results = await Promise.all([
      withResourceLock('room-1', task('a', 30)),
      withResourceLock('room-1', task('b', 5)),
      withResourceLock('room-1', task('c', 1)),
    ]);

    expect(results).toEqual(['a', 'b', 'c']);
    expect(log).toEqual(['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end']);
  });

  it('releases the lock when a task throws, so later tasks still run', async () => {
    const failing = withResourceLock('room-2', async () => {
      throw new Error('booking rejected');
    });
    const next = withResourceLock('room-2', async () => 'ran');

    await expect(failing).rejects.toThrow('booking rejected');
    await expect(next).resolves.toBe('ran');
  });

  it('does not make different keys wait for each other', async () => {
    const log: string[] = [];
    await Promise.all([
      withResourceLock('room-3', async () => {
        await delay(30);
        log.push('slow room-3');
      }),
      withResourceLock('room-4', async () => {
        log.push('fast room-4');
      }),
    ]);
    expect(log).toEqual(['fast room-4', 'slow room-3']);
  });
});
