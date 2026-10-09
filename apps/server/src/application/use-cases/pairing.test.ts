import { InMemoryStore } from '../testing/in-memory-store';
import type { Clock } from '../ports/clock';
import { createFakePairingCrypto } from '../testing/fake-pairing-crypto';
import { createPairingCode } from './create-pairing-code';
import {
  claimPairingCode,
  InvalidCodeError,
  TooManyAttemptsError,
} from './claim-pairing-code';

class FakeClock implements Clock {
  constructor(public ms = Date.parse('2026-10-01T10:00:00.000Z')) {}
  nowMs() {
    return this.ms;
  }
}

const setup = () => {
  const store = new InMemoryStore();
  const clock = new FakeClock();
  const crypto = createFakePairingCrypto();
  const deps = { store, clock, crypto, ids: { next: () => 'device-1' } };
  return { store, clock, crypto, deps };
};

describe('createPairingCode', () => {
  it('returns a code expiring in 10 minutes and stores only its hash', async () => {
    const { store, deps, crypto } = setup();

    const { code, expiresAt } = await createPairingCode(deps, null);

    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(expiresAt).toBe('2026-10-01T10:10:00.000Z');
    await store.run(async ({ pairingCodes }) => {
      const stored = await pairingCodes.findByHash(crypto.sha256Hex(code));
      expect(stored).toEqual({
        codeHash: crypto.sha256Hex(code),
        createdBy: null,
        expiresAt,
        usedAt: null,
      });
      expect(JSON.stringify(stored)).not.toContain(code);
    });
  });

  it('records the device that created the code', async () => {
    const { store, deps, crypto } = setup();
    const { code } = await createPairingCode(deps, 'device-9');
    await store.run(async ({ pairingCodes }) => {
      expect(
        (await pairingCodes.findByHash(crypto.sha256Hex(code)))?.createdBy,
      ).toBe('device-9');
    });
  });
});

describe('claimPairingCode', () => {
  it('creates a device storing only the credential hash, and marks the code used', async () => {
    const { store, deps, crypto } = setup();
    const { code } = await createPairingCode(deps, null);

    const result = await claimPairingCode(deps, code, '  Pixel de Marie ');

    expect(result.deviceId).toBe('device-1');
    await store.run(async ({ devices, pairingCodes }) => {
      const device = await devices.get('device-1');
      expect(device).toEqual({
        id: 'device-1',
        name: 'Pixel de Marie',
        credentialHash: crypto.sha256Hex(result.credential),
        createdAt: '2026-10-01T10:00:00.000Z',
        lastSyncAt: null,
        revokedAt: null,
      });
      expect(JSON.stringify(device)).not.toContain(result.credential);
      expect(
        (await pairingCodes.findByHash(crypto.sha256Hex(code)))?.usedAt,
      ).toBe('2026-10-01T10:00:00.000Z');
    });
  });

  it('accepts a code typed in lower case without the dash', async () => {
    const { deps } = setup();
    const { code } = await createPairingCode(deps, null);
    const typed = code.replace('-', '').toLowerCase();

    await expect(claimPairingCode(deps, typed, 'Phone')).resolves.toEqual(
      expect.objectContaining({ deviceId: 'device-1' }),
    );
  });

  it('rejects an unknown code and records a failure', async () => {
    const { store, deps } = setup();

    await expect(claimPairingCode(deps, 'ZZZZ-ZZZZ', 'Phone')).rejects.toThrow(
      InvalidCodeError,
    );
    await store.run(async ({ pairingFailures }) => {
      expect(await pairingFailures.countSince('2026-10-01T00:00:00.000Z')).toBe(
        1,
      );
    });
  });

  it('rejects a used code', async () => {
    const { deps } = setup();
    const { code } = await createPairingCode(deps, null);
    await claimPairingCode(deps, code, 'Phone');

    await expect(claimPairingCode(deps, code, 'Phone')).rejects.toThrow(
      InvalidCodeError,
    );
  });

  it('rejects a code older than 10 minutes', async () => {
    const { deps, clock } = setup();
    const { code } = await createPairingCode(deps, null);
    clock.ms += 10 * 60 * 1000;

    await expect(claimPairingCode(deps, code, 'Phone')).rejects.toThrow(
      InvalidCodeError,
    );
  });

  it('keeps a failed claim from creating a device', async () => {
    const { store, deps } = setup();
    await claimPairingCode(deps, 'ZZZZ-ZZZZ', 'Phone').catch(() => undefined);
    await store.run(async ({ devices }) => {
      expect(await devices.all()).toEqual([]);
    });
  });

  it('rejects a device name that is empty or over 60 characters, without burning the code', async () => {
    const { store, deps, crypto } = setup();
    const { code } = await createPairingCode(deps, null);

    await expect(claimPairingCode(deps, code, '   ')).rejects.toThrow(
      'InvalidDeviceName',
    );
    await expect(claimPairingCode(deps, code, 'x'.repeat(61))).rejects.toThrow(
      'InvalidDeviceName',
    );
    await store.run(async ({ pairingCodes, pairingFailures }) => {
      expect(
        (await pairingCodes.findByHash(crypto.sha256Hex(code)))?.usedAt,
      ).toBeNull();
      expect(await pairingFailures.countSince('2026-10-01T00:00:00.000Z')).toBe(
        0,
      );
    });
    await expect(
      claimPairingCode(deps, code, 'x'.repeat(60)),
    ).resolves.toBeDefined();
  });

  describe('rate limit', () => {
    const fail = (deps: ReturnType<typeof setup>['deps']) =>
      claimPairingCode(deps, 'ZZZZ-ZZZZ', 'Phone').catch((e) => e);

    it('answers TooManyAttempts from the 6th failure within 10 minutes, with the seconds to wait', async () => {
      const { deps, clock } = setup();
      for (let i = 0; i < 5; i++) {
        expect(await fail(deps)).toBeInstanceOf(InvalidCodeError);
        clock.ms += 1000;
      }

      const error = await fail(deps);

      expect(error).toBeInstanceOf(TooManyAttemptsError);
      // The first failure was 5 s ago: it leaves the window in 595 s.
      expect((error as TooManyAttemptsError).retryAfterSeconds).toBe(595);
    });

    it('blocks even a valid code while the limit holds', async () => {
      const { deps } = setup();
      const { code } = await createPairingCode(deps, null);
      for (let i = 0; i < 5; i++) await fail(deps);

      await expect(claimPairingCode(deps, code, 'Phone')).rejects.toThrow(
        TooManyAttemptsError,
      );
    });

    it('lets claims through again once the failures leave the window', async () => {
      const { deps, clock } = setup();
      for (let i = 0; i < 5; i++) await fail(deps);
      clock.ms += 10 * 60 * 1000 + 1;
      const { code } = await createPairingCode(deps, null);

      await expect(claimPairingCode(deps, code, 'Phone')).resolves.toEqual(
        expect.objectContaining({ deviceId: 'device-1' }),
      );
    });

    it('persists across a new store instance on the same data', async () => {
      const { store, deps } = setup();
      for (let i = 0; i < 5; i++) await fail(deps);

      // A restart builds the use case again over the same store.
      const restarted = { ...deps, store };
      expect(await fail(restarted)).toBeInstanceOf(TooManyAttemptsError);
    });
  });
});
