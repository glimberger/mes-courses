import type { ServerStore } from '../../ports/store';
import { device } from './entities';

export const deviceRepositoryContract = (
  createStore: () => Promise<ServerStore>,
) => {
  describe('DeviceRepository contract', () => {
    let store: ServerStore;

    beforeEach(async () => {
      store = await createStore();
    });

    it('finds nothing in an empty store', async () => {
      await store.run(async ({ devices }) => {
        expect(await devices.get('d-1')).toBeNull();
        expect(await devices.findByCredentialHash('h-1')).toBeNull();
        expect(await devices.all()).toEqual([]);
      });
    });

    it('returns a device by id and by credential hash', async () => {
      const record = device('d-1', 'h-1');
      await store.run(({ devices }) => devices.add(record));

      await store.run(async ({ devices }) => {
        expect(await devices.get('d-1')).toEqual(record);
        expect(await devices.findByCredentialHash('h-1')).toEqual(record);
        expect(await devices.findByCredentialHash('h-2')).toBeNull();
      });
    });

    it('update replaces the device with the same id', async () => {
      await store.run(({ devices }) => devices.add(device('d-1', 'h-1')));
      const revoked = device('d-1', 'h-1', {
        name: 'Tablette',
        lastSyncAt: '2026-10-02T08:00:00.000Z',
        revokedAt: '2026-10-03T08:00:00.000Z',
      });
      await store.run(({ devices }) => devices.update(revoked));

      await store.run(async ({ devices }) => {
        expect(await devices.get('d-1')).toEqual(revoked);
        expect(await devices.all()).toEqual([revoked]);
      });
    });

    it('lists the devices by creation time, then id', async () => {
      await store.run(async ({ devices }) => {
        await devices.add(
          device('d-2', 'h-2', { createdAt: '2026-10-02T10:00:00.000Z' }),
        );
        await devices.add(device('d-3', 'h-3'));
        await devices.add(device('d-1', 'h-1'));

        expect((await devices.all()).map((d) => d.id)).toEqual([
          'd-1',
          'd-3',
          'd-2',
        ]);
      });
    });
  });
};
