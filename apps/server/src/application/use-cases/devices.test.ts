import type { Clock } from '../ports/clock';
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
  await store.run(async ({ devices }) => {
    await devices.add(device('a'));
    await devices.add(device('b', { lastSyncAt: '2026-09-30T08:00:00.000Z' }));
    await devices.add(device('c', { revokedAt: '2026-09-15T00:00:00.000Z' }));
  });
  return { store, clock, deps: { store, clock } };
};

describe('listDevices', () => {
  it('003 US4-8 lists the authorized devices without the credential hash', async () => {
    const { deps } = await setup();

    expect(await listDevices(deps)).toEqual([
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

    expect(await renameDevice(deps, 'a', '  Pixel de Marie ')).toEqual({
      id: 'a',
      name: 'Pixel de Marie',
    });
    await store.run(async ({ devices }) => {
      expect((await devices.get('a'))?.name).toBe('Pixel de Marie');
    });
  });

  it('rejects an empty or a 61-character name', async () => {
    const { deps } = await setup();

    await expect(renameDevice(deps, 'a', '   ')).rejects.toBeInstanceOf(
      InvalidDeviceNameError,
    );
    await expect(
      renameDevice(deps, 'a', 'x'.repeat(61)),
    ).rejects.toBeInstanceOf(InvalidDeviceNameError);
  });

  it('answers NotFound for an unknown or a revoked device', async () => {
    const { deps } = await setup();

    await expect(renameDevice(deps, 'zzz', 'Name')).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(renameDevice(deps, 'c', 'Name')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('revokeDevice', () => {
  it('003 US4-9 sets revokedAt, so the device disappears from the list', async () => {
    const { store, deps } = await setup();

    await revokeDevice(deps, 'b');

    await store.run(async ({ devices }) => {
      expect((await devices.get('b'))?.revokedAt).toBe(
        '2026-10-01T10:00:00.000Z',
      );
    });
    expect((await listDevices(deps)).map((d) => d.id)).toEqual(['a']);
  });

  it('003 US4-11 lets a device revoke itself', async () => {
    const { deps } = await setup();

    await revokeDevice(deps, 'a');

    expect((await listDevices(deps)).map((d) => d.id)).toEqual(['b']);
  });

  it('answers NotFound for an unknown or an already revoked device', async () => {
    const { deps } = await setup();

    await expect(revokeDevice(deps, 'zzz')).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(revokeDevice(deps, 'c')).rejects.toBeInstanceOf(NotFoundError);
  });
});
