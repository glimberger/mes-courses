import type {
  DeviceNotFound,
  SyncFailure,
} from '../../../application/ports/sync-server';
import type { DeleteMyAccountError } from '../../../application/use-cases/delete-my-account';
import type { ChangeServerUrlError } from '../../../application/use-cases/change-server-url';
import type { DeviceInfo } from '../../../application/use-cases/list-devices';
import type { NameError } from '../../../domain/name';
import { err, ok, type Result } from '../../../domain/result';
import { reactToFailure } from './failure-reactions';
import type { StoreKit, SyncSlice, WriteFailed } from './store-kit';
import { UnexpectedResult } from './unexpected-result';

/** The actions of the device management of Settings (US4-3, US4-8, US4-9, US4-11, FR-016). */
export type DeviceActions = {
  listDevices: () => Promise<Result<DeviceInfo[], SyncFailure>>;
  renameDevice: (
    id: string,
    name: string,
  ) => Promise<Result<void, NameError | SyncFailure | DeviceNotFound>>;
  revokeDevice: (
    id: string,
  ) => Promise<Result<void, SyncFailure | DeviceNotFound>>;
  /** Signs this device out; its copy of the lists is erased (US6-4). */
  signOut: () => Promise<Result<void, WriteFailed>>;
  /** Deletes the account after checking the password, then leaves as `signOut` does (US6-6). */
  deleteMyAccount: (
    password: string,
  ) => Promise<Result<void, DeleteMyAccountError | WriteFailed>>;
  /** Moves the connection to a new address of the same server (FR-016). */
  changeServerUrl: (
    url: string,
  ) => Promise<Result<void, ChangeServerUrlError | WriteFailed>>;
};

type Helpers = {
  /** Reads the address, the last sync and the connection again into the slice. */
  loadSyncInfo: (keepConnection?: boolean) => Promise<boolean>;
  /** Resolves once the running sync cycle, if any, is over: it saves the sync state last. */
  waitForCycle: () => Promise<void>;
  setSync: (partial: Partial<SyncSlice>) => void;
  /** Forgets the failures of the sync cycles, as a new connection starts afresh. */
  resetFailures: () => void;
};

const SCREEN = 'Settings';

export const createDeviceActions = (
  kit: StoreKit,
  { loadSyncInfo, waitForCycle, setSync, resetFailures }: Helpers,
): DeviceActions => {
  const { set, useCases, report, onLocalWrite } = kit;
  /**
   * Runs a use case. A throw is reported and answered as a server error, since the request may
   * have failed in any way; a failure result changes the connection or is reported as the tag
   * alone, never the address or a name (Principle VIII). Offline is normal and never reported.
   */
  const call = async <T, E extends { type: string }>(
    operation: string,
    run: () => Promise<Result<T, E | SyncFailure>>,
  ): Promise<Result<T, E | SyncFailure>> => {
    let outcome: Result<T, E | SyncFailure>;
    try {
      outcome = await run();
    } catch (error) {
      report(error, operation, SCREEN);
      return err({ type: 'ServerError' });
    }
    if (!outcome.ok) reactToFailure(kit, operation, SCREEN, outcome.error);
    return outcome;
  };

  /** The copy is erased and the credential gone: the device reads as a first launch. */
  const returnToFirstLaunch = async () => {
    resetFailures();
    set({ pendingUndo: null });
    setSync({
      connection: 'notConnected',
      signedOutReason: null,
      status: 'saved',
    });
    await loadSyncInfo();
    await kit.get().refresh();
  };

  return {
    listDevices: () => call('listDevices', () => useCases.listDevices()),
    renameDevice: (id, name) =>
      call('renameDevice', () => useCases.renameDevice(id, name)),
    revokeDevice: (id) => call('revokeDevice', () => useCases.revokeDevice(id)),

    signOut: async () => {
      // A cycle saving its state after the erasure would restore the old server fields.
      await waitForCycle();
      try {
        await useCases.signOut();
      } catch (error) {
        set({ notice: { type: 'writeFailed' } });
        report(error, 'signOut', SCREEN);
        return err({ type: 'WriteFailed' });
      }
      await returnToFirstLaunch();
      return ok(undefined);
    },

    deleteMyAccount: async (password) => {
      await waitForCycle();
      let outcome: Awaited<ReturnType<typeof useCases.deleteMyAccount>>;
      try {
        outcome = await useCases.deleteMyAccount(password);
      } catch (error) {
        // The request may have failed in any way: nothing is known to have changed.
        set({ notice: { type: 'writeFailed' } });
        report(error, 'deleteMyAccount', SCREEN);
        return err({ type: 'WriteFailed' });
      }
      if (!outcome.ok) {
        reactToFailure(kit, 'deleteMyAccount', SCREEN, outcome.error);
        return outcome;
      }
      await returnToFirstLaunch();
      return ok(undefined);
    },

    changeServerUrl: async (url) => {
      // A cycle saving its state after the change would revert the new address.
      await waitForCycle();
      let outcome: Awaited<ReturnType<typeof useCases.changeServerUrl>>;
      try {
        outcome = await useCases.changeServerUrl(url);
      } catch (error) {
        set({ notice: { type: 'writeFailed' } });
        report(error, 'changeServerUrl', SCREEN);
        return err({ type: 'WriteFailed' });
      }
      if (!outcome.ok) {
        // Only the tag is reported, never the address the user typed (FR-019, 001 FR-030).
        if (outcome.error.type === 'UntrustedServer') {
          report(
            new UnexpectedResult(outcome.error.type),
            'changeServerUrl',
            SCREEN,
          );
        }
        return err(outcome.error);
      }
      resetFailures();
      // The address does not change the connection: a revoked or outdated app stays so.
      await loadSyncInfo(true);
      // The first cycle at the new address starts soon, not after the current delay.
      onLocalWrite();
      return ok(undefined);
    },
  };
};
