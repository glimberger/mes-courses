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
  switch (failure.type) {
    case 'DeviceNotAuthorized':
    case 'UpdateRequired':
      set({
        sync: {
          ...get().sync,
          connection:
            failure.type === 'UpdateRequired'
              ? 'updateRequired'
              : 'disconnectedByServer',
        },
      });
      break;
    case 'ServerError':
    case 'UntrustedServer':
      report(new UnexpectedResult(failure.type), operation, screen);
      break;
  }
};
