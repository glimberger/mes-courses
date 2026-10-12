import type { Clock } from '../ports/clock';
import { account } from '../testing/contracts/entities';
import { InMemoryStore } from '../testing/in-memory-store';
import type { DeviceRecord } from '../ports/store';
import { InvalidDeviceNameError } from './claim-pairing-code';
import { listDevices } from './list-devices';
import { NotFoundError } from './not-found';
import { renameDevice } from './rename-device';
import { revokeDevice } from './revoke-device';

class FakeClock implements Clock {
  ms = Date.parse('2026-10-01T10:00:00.000Z');
  nowMs() {
    return this.ms;
  }
}

const device = (
  id: string,
  over: Partial<DeviceRecord> = {},
): DeviceRecord => ({
  id,
  accountId: 'acc-1',
  name: `Phone ${id}`,
  credentialHash: `hash-${id}`,
  createdAt: '2026-09-01T10:00:00.000Z',
  lastSyncAt: null,
  revokedAt: null,
  ...over,
});

const setup = async () => {
  const store = new InMemoryStore();
  const clock = new FakeClock();
  await store.run(async ({ accounts, devices }) => {
    await accounts.add(account('acc-1', 'marie@example.org'));
    await accounts.add(account('acc-2', 'paul@example.org'));
    await devices.add(device('other', { accountId: 'acc-2' }));
    await devices.add(device('a'));
    await devices.add(device('b', { lastSyncAt: '2026-09-30T08:00:00.000Z' }));
    await devices.add(device('c', { revokedAt: '2026-09-15T00:00:00.000Z' }));
  });
  return { store, clock, deps: { store, clock } };
};

describe('listDevices', () => {
  it('003 US4-8 lists the authorized devices without the credential hash', async () => {
    const { deps } = await setup();

    expect(await listDevices(deps, 'acc-1')).toEqual([
      {
        id: 'a',
        name: 'Phone a',
        createdAt: '2026-09-01T10:00:00.000Z',
        lastSyncAt: null,
      },
      {
        id: 'b',
        name: 'Phone b',
        createdAt: '2026-09-01T10:00:00.000Z',
        lastSyncAt: '2026-09-30T08:00:00.000Z',
      },
    ]);
  });
});

describe('renameDevice', () => {
  it('trims the name and saves it', async () => {
    const { store, deps } = await setup();

    expect(await renameDevice(deps, 'acc-1', 'a', '  Pixel de Marie ')).toEqual(
      {
        id: 'a',
        name: 'Pixel de Marie',
      },
    );
    await store.run(async ({ devices }) => {
      expect((await devices.get('a'))?.name).toBe('Pixel de Marie');
    });
  });

  it('rejects an empty or a 61-character name', async () => {
    const { deps } = await setup();

    await expect(
      renameDevice(deps, 'acc-1', 'a', '   '),
    ).rejects.toBeInstanceOf(InvalidDeviceNameError);
    await expect(
      renameDevice(deps, 'acc-1', 'a', 'x'.repeat(61)),
    ).rejects.toBeInstanceOf(InvalidDeviceNameError);
  });

  it('answers NotFound for an unknown or a revoked device', async () => {
    const { deps } = await setup();

    await expect(
      renameDevice(deps, 'acc-1', 'zzz', 'Name'),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      renameDevice(deps, 'acc-1', 'c', 'Name'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('revokeDevice', () => {
  it('003 US4-9 sets revokedAt, so the device disappears from the list', async () => {
    const { store, deps } = await setup();

    await revokeDevice(deps, 'acc-1', 'b');

    await store.run(async ({ devices }) => {
      expect((await devices.get('b'))?.revokedAt).toBe(
        '2026-10-01T10:00:00.000Z',
      );
    });
    expect((await listDevices(deps, 'acc-1')).map((d) => d.id)).toEqual(['a']);
  });

  it('003 US4-11 lets a device revoke itself', async () => {
    const { deps } = await setup();

    await revokeDevice(deps, 'acc-1', 'a');

    expect((await listDevices(deps, 'acc-1')).map((d) => d.id)).toEqual(['b']);
  });

  it('answers NotFound for an unknown or an already revoked device', async () => {
    const { deps } = await setup();

    await expect(revokeDevice(deps, 'acc-1', 'zzz')).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(revokeDevice(deps, 'acc-1', 'c')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('004 US3-3 devices stay within their account', () => {
  it('lists only the devices of the caller account', async () => {
    const { deps } = await setup();

    expect((await listDevices(deps, 'acc-2')).map((d) => d.id)).toEqual([
      'other',
    ]);
    expect((await listDevices(deps, 'acc-1')).map((d) => d.id)).not.toContain(
      'other',
    );
  });

  it('answers NotFound for another account device on rename and revoke, and changes nothing', async () => {
    const { store, deps } = await setup();

    await expect(
      renameDevice(deps, 'acc-1', 'other', 'Volé'),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(revokeDevice(deps, 'acc-1', 'other')).rejects.toBeInstanceOf(
      NotFoundError,
    );

    await store.run(async ({ devices }) => {
      const other = await devices.get('other');
      expect(other?.name).toBe('Phone other');
      expect(other?.revokedAt).toBeNull();
    });
  });
});
