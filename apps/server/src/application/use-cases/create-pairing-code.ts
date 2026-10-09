import { CODE_LIFETIME_MS } from '../../domain/pairing';
import type { Clock } from '../ports/clock';
import type { PairingCrypto } from '../ports/pairing-crypto';
import type { ServerStore } from '../ports/store';

export type CreatePairingCodeDeps = {
  store: ServerStore;
  clock: Clock;
  crypto: PairingCrypto;
};

/** A single-use code valid for 10 minutes; only its hash is stored (US4-2, US4-3). */
export const createPairingCode = async (
  { store, clock, crypto }: CreatePairingCodeDeps,
  createdBy: string | null,
): Promise<{ code: string; expiresAt: string }> => {
  const code = crypto.generateCode();
  const expiresAt = new Date(clock.nowMs() + CODE_LIFETIME_MS).toISOString();
  await store.run(({ pairingCodes }) =>
    pairingCodes.add({
      codeHash: crypto.sha256Hex(crypto.normalizeCode(code)),
      createdBy,
      expiresAt,
      usedAt: null,
    }),
  );
  return { code, expiresAt };
};
