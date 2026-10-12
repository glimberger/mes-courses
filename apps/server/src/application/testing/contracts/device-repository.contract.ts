import { device } from './entities';
import { DEFAULT_ACCOUNT_ID, type ScopedStore } from './scoped-store';

export const deviceRepositoryContract = (
  createStore: () => Promise<ScopedStore>,
) => {
  describe('DeviceRepository contract', () => {
    let store: ScopedStore;

    beforeEach(async () => {
      store = await createStore();
    });

    it('finds nothing in an empty store', async () => {
      await store.run(async ({ devices }) => {
        expect(await devices.get('d-1')).toBeNull();
        expect(await devices.findByCredentialHash('h-1')).toBeNull();
        expect(await devices.forAccount(DEFAULT_ACCOUNT_ID)).toEqual([]);
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

    it('rejects a duplicate id or credential hash', async () => {
      await store.run(({ devices }) => devices.add(device('d-1', 'h-1')));

      await expect(
        store.run(({ devices }) => devices.add(device('d-1', 'h-2'))),
      ).rejects.toThrow();
      await expect(
        store.run(({ devices }) => devices.add(device('d-2', 'h-1'))),
      ).rejects.toThrow();
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
        expect(await devices.forAccount(DEFAULT_ACCOUNT_ID)).toEqual([revoked]);
      });
    });

    it('lists the devices by creation time, then id', async () => {
      await store.run(async ({ devices }) => {
        await devices.add(
          device('d-2', 'h-2', { createdAt: '2026-10-02T10:00:00.000Z' }),
        );
        await devices.add(device('d-3', 'h-3'));
        await devices.add(device('d-1', 'h-1'));

        expect(
          (await devices.forAccount(DEFAULT_ACCOUNT_ID)).map((d) => d.id),
        ).toEqual(['d-1', 'd-3', 'd-2']);
      });
    });
  });
};
