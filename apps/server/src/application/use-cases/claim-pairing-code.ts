import {
  cleanDeviceName,
  FAILURE_WINDOW_MS,
  MAX_FAILURES_IN_WINDOW,
  retryAfterSeconds,
} from '../../domain/pairing';
import type { Clock } from '../ports/clock';
import type { IdGenerator } from '../ports/id-generator';
import type { PairingCrypto } from '../ports/pairing-crypto';
import type { ServerStore } from '../ports/store';

/** Unknown, expired or used code. */
export class InvalidCodeError extends Error {
  constructor() {
    super('InvalidCode');
  }
}

export class TooManyAttemptsError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('TooManyAttempts');
  }
}

export class InvalidDeviceNameError extends Error {
  constructor() {
    super('InvalidDeviceName');
  }
}

export type ClaimPairingCodeDeps = {
  store: ServerStore;
  clock: Clock;
  crypto: PairingCrypto;
  ids: IdGenerator;
};

type Outcome =
  | { kind: 'claimed'; deviceId: string; credential: string }
  | { kind: 'invalid' }
  | { kind: 'blocked'; retryAfterSeconds: number };

/**
 * Claims a code and authorizes a device (US4-4). The check, the failure record and the device are
 * one transaction. A failure is recorded by returning an outcome, not by throwing: a throw would
 * roll the record back.
 */
export const claimPairingCode = async (
  { store, clock, crypto, ids }: ClaimPairingCodeDeps,
  code: string,
  deviceName: string,
): Promise<{ deviceId: string; credential: string }> => {
  const name = cleanDeviceName(deviceName);
  if (name === null) throw new InvalidDeviceNameError();

  const outcome = await store.run(
    async ({ pairingCodes, pairingFailures, devices }): Promise<Outcome> => {
      const nowMs = clock.nowMs();
      const now = new Date(nowMs).toISOString();
      const since = new Date(nowMs - FAILURE_WINDOW_MS).toISOString();

      if ((await pairingFailures.countSince(since)) >= MAX_FAILURES_IN_WINDOW) {
        const earliest = await pairingFailures.earliestSince(since);
        return {
          kind: 'blocked',
          retryAfterSeconds: retryAfterSeconds(
            nowMs,
            earliest === null ? nowMs : Date.parse(earliest),
          ),
        };
      }

      const codeHash = crypto.sha256Hex(crypto.normalizeCode(code));
      const stored = await pairingCodes.findByHash(codeHash);
      if (
        stored === null ||
        stored.usedAt !== null ||
        stored.expiresAt <= now
      ) {
        await pairingFailures.add(now);
        await pairingFailures.pruneBefore(since);
        return { kind: 'invalid' };
      }

      const credential = crypto.generateCredential();
      const deviceId = ids.next();
      await pairingCodes.markUsed(codeHash, now);
      await devices.add({
        id: deviceId,
        name,
        credentialHash: crypto.sha256Hex(credential),
        createdAt: now,
        lastSyncAt: null,
        revokedAt: null,
      });
      return { kind: 'claimed', deviceId, credential };
    },
  );

  if (outcome.kind === 'blocked') {
    throw new TooManyAttemptsError(outcome.retryAfterSeconds);
  }
  if (outcome.kind === 'invalid') throw new InvalidCodeError();
  return { deviceId: outcome.deviceId, credential: outcome.credential };
};
