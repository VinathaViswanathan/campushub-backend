import { beforeEach, describe, expect, it } from '@jest/globals';
import { createResource } from '../../test/factories';
import { listResources } from '../resource.service';

describe('listResources', () => {
  beforeEach(async () => {
    await createResource({ name: 'Study Room 302', type: 'ROOM', isAvailable: true });
    await createResource({ name: 'Conference Room B', type: 'ROOM', isAvailable: true });
    await createResource({ name: 'Projector #3', type: 'EQUIPMENT', isAvailable: true });
    await createResource({ name: 'Robotics Lab', type: 'LAB', isAvailable: true });
    await createResource({ name: 'Chemistry Lab 2', type: 'LAB', isAvailable: false });
  });

  const names = async (...args: Parameters<typeof listResources>): Promise<string[]> =>
    (await listResources(...args)).map((r) => r.name);

  it('returns every resource sorted by name, with only the contract fields', async () => {
    const all = await listResources();
    expect(all.map((r) => r.name)).toEqual([
      'Chemistry Lab 2',
      'Conference Room B',
      'Projector #3',
      'Robotics Lab',
      'Study Room 302',
    ]);
    expect(Object.keys(all[0]!).sort()).toEqual(['id', 'isAvailable', 'location', 'name', 'type']);
  });

  it('filters by type', async () => {
    await expect(names({ type: 'ROOM' })).resolves.toEqual(['Conference Room B', 'Study Room 302']);
  });

  it.each<[boolean, string[]]>([
    [true, ['Conference Room B', 'Projector #3', 'Robotics Lab', 'Study Room 302']],
    [false, ['Chemistry Lab 2']],
  ])('filters by isAvailable=%p', async (isAvailable, expected) => {
    await expect(names({ isAvailable })).resolves.toEqual(expected);
  });

  it('combines type and isAvailable with AND', async () => {
    await expect(names({ type: 'LAB', isAvailable: true })).resolves.toEqual(['Robotics Lab']);
    await expect(names({ type: 'LAB', isAvailable: false })).resolves.toEqual(['Chemistry Lab 2']);
  });

  it.each(['FOO', 'room', 'ROOMS', ' ROOM'])('returns [] for an unknown type %p instead of an error', async (type) => {
    await expect(listResources({ type })).resolves.toEqual([]);
  });
});
