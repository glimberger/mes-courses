import { reactToFailure } from './failure-reactions';
import type { StoreKit } from './store-kit';

const run = (connection: string) => {
  let sync = { connection, signedOutReason: 'revoked' } as never as {
    connection: string;
  };
  const kit = {
    get: () => ({ sync }),
    set: (patch: { sync: typeof sync }) => {
      sync = patch.sync;
    },
    report: jest.fn(),
  } as never as Pick<StoreKit, 'get' | 'set' | 'report'>;
  reactToFailure(kit, 'op', 'screen', { type: 'UpdateRequired' });
  return sync.connection;
};

describe('reactToFailure', () => {
  it('004 US5 marks an outdated app on a connected device', () => {
    expect(run('connected')).toBe('updateRequired');
  });

  it('004 US5 keeps the signed-out state, whose notice the device still has to show', () => {
    expect(run('signedOut')).toBe('signedOut');
  });
});
