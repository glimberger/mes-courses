import type { StoreKit } from './store-kit';
import { UnexpectedResult } from './unexpected-result';

/**
 * What the store does about a failed request to the server, whichever screen made it: a refused
 * device or an outdated app changes the connection, and an unexpected answer is reported as its
 * tag alone, never the address or a name (Principle VIII). Offline is normal and never reported.
 */
export const reactToFailure = (
  { get, set, report }: Pick<StoreKit, 'get' | 'set' | 'report'>,
  operation: string,
  screen: string,
  failure: { type: string },
): void => {
  const { sync } = get();
  // A device that is not connected has no connection to lose: a sign-in refused with the same
  // tag (a suspended account) is the screen's to show.
  const live =
    sync.connection === 'connected' || sync.connection === 'suspended';
  switch (failure.type) {
    case 'UpdateRequired':
      // A signed-out device keeps its notice: the acknowledge-and-erase flow reads it.
      if (sync.connection === 'signedOut') break;
      set({ sync: { ...sync, connection: 'updateRequired' } });
      break;
    case 'DeviceNotAuthorized':
      set({
        sync: { ...sync, connection: 'signedOut', signedOutReason: 'revoked' },
      });
      break;
    case 'AccountDeleted':
      if (!live) break;
      set({
        sync: {
          ...sync,
          connection: 'signedOut',
          signedOutReason: 'accountDeleted',
        },
      });
      break;
    case 'AccountSuspended':
      if (sync.connection !== 'connected') break;
      set({ sync: { ...sync, connection: 'suspended' } });
      break;
    case 'ServerError':
    case 'UntrustedServer':
      report(new UnexpectedResult(failure.type), operation, screen);
      break;
  }
};
