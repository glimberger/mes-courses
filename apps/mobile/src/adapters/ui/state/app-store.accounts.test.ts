import { err, ok } from '../../../domain/result';
import { fixture } from '../testing/fixtures';
import { buildStoryStore, type StoryScenario } from '../testing/story-store';

const connected = {
  serverUrl: 'https://courses.example.fr',
  lastSyncAt: null,
};

const build = (scenario: StoryScenario = {}) =>
  buildStoryStore({ seed: fixture, connected, ...scenario });

const summary = {
  id: 'account-2',
  email: 'marie@example.org',
  role: 'user' as const,
  state: 'invited' as const,
  lastSyncAt: null,
  invitationExpired: false,
};

describe('accounts actions', () => {
  it('004 US1-1 inviting an address sets the notice with the address, in memory only', async () => {
    const { store, errorReporter } = await build({
      adminServer: { invite: async () => ok(summary) },
    });

    const outcome = await store.getState().inviteAccount('marie@example.org');

    expect(outcome.ok).toBe(true);
    expect(store.getState().notice).toEqual({
      type: 'invitationSent',
      email: 'marie@example.org',
    });
    expect(errorReporter.reports).toEqual([]);
  });

  it('004 US1-2 a refused invitation sets no notice and reports nothing', async () => {
    const { store, errorReporter } = await build({
      adminServer: { invite: async () => err({ type: 'AccountExists' }) },
    });

    const outcome = await store.getState().inviteAccount('marie@example.org');

    expect(outcome).toEqual(err({ type: 'AccountExists' }));
    expect(store.getState().notice).toBeNull();
    expect(errorReporter.reports).toEqual([]);
  });

  it('004 FR-020 reports an unexpected answer by its tag alone, never the address', async () => {
    const { store, errorReporter } = await build({
      adminServer: { invite: async () => err({ type: 'ServerError' }) },
    });

    await store.getState().inviteAccount('marie@example.org');

    expect(errorReporter.reports).toHaveLength(1);
    expect(errorReporter.reports[0]?.context).toMatchObject({
      operation: 'inviteAccount',
      screen: 'Accounts',
    });
    expect(JSON.stringify(errorReporter.reports)).not.toContain('marie@');
  });

  it('004 a device the server refuses signs the device out', async () => {
    const { store } = await build({
      adminServer: {
        listAccounts: async () => err({ type: 'DeviceNotAuthorized' }),
      },
    });

    await store.getState().listAccounts();

    expect(store.getState().sync.connection).toBe('signedOut');
  });

  it('004 offline is normal: nothing is reported and the connection is unchanged', async () => {
    const { store, errorReporter } = await build();

    const outcome = await store.getState().listAccounts();

    expect(outcome).toEqual(err({ type: 'Offline' }));
    expect(errorReporter.reports).toEqual([]);
    expect(store.getState().sync.connection).toBe('connected');
  });

  it('004 a use case that throws is reported and answered as a server error', async () => {
    const { store, errorReporter } = await build({ failing: ['listAccounts'] });

    const outcome = await store.getState().listAccounts();

    expect(outcome).toEqual(err({ type: 'ServerError' }));
    expect(errorReporter.reports).toHaveLength(1);
  });

  it('004 US6-1 getAccountSettings returns the account and reports a refusal once', async () => {
    const { store } = await build({
      accountServer: {
        getAccount: async () =>
          ok({ id: 'a', email: 'marie@example.org', role: 'user' }),
      },
      syncServer: { listDevices: async () => ok([]) },
    });

    const settings = await store.getState().getAccountSettings();

    expect(settings.account).toEqual(
      ok({ id: 'a', email: 'marie@example.org', role: 'user' }),
    );
    expect(settings.devices).toEqual(ok([]));
  });
});
