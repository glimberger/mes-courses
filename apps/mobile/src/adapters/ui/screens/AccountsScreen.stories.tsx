import type { Meta, StoryObj } from '@storybook/react-native';
import type { AccountSummary } from '@mes-courses/sync-core';

import { ok } from '../../../domain/result';
import { fixture } from '../testing/fixtures';
import { AccountsScreen } from './AccountsScreen';

const meta = {
  title: 'Screens/Accounts',
  component: AccountsScreen,
} satisfies Meta<typeof AccountsScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

const connected = {
  serverUrl: 'https://courses.example.fr',
  lastSyncAt: new Date(Date.now() - 5 * 60_000).toISOString(),
};

const account = (
  id: string,
  email: string,
  overrides: Partial<AccountSummary> = {},
): AccountSummary => ({
  id,
  email,
  role: 'user',
  state: 'active',
  lastSyncAt: connected.lastSyncAt,
  invitationExpired: false,
  ...overrides,
});

const administrator = account('account-1', 'admin@example.org', {
  role: 'administrator',
});

const withAccounts = (accounts: AccountSummary[]) => ({
  seed: fixture,
  connected,
  adminServer: { listAccounts: async () => ok(accounts) },
});

export const Loading: Story = {
  parameters: {
    scenario: { seed: fixture, connected, pending: ['listAccounts'] },
  },
};

const LoadFailed: Story = {
  parameters: {
    scenario: { seed: fixture, connected, failing: ['listAccounts'] },
  },
};

// Exported under the state's name without hiding the global `Error` in this file.
export { LoadFailed as Error };

/** The server cannot be reached: said without error colors. */
export const Offline: Story = {
  parameters: { scenario: { seed: fixture, connected } },
};

/** Only the administrator exists: "Vous êtes le seul utilisateur." */
export const Empty: Story = {
  parameters: { scenario: withAccounts([administrator]) },
};

/** The three account states, and an invitation that expired. */
export const Success: Story = {
  parameters: {
    scenario: withAccounts([
      administrator,
      account('account-2', 'lea@example.org'),
      account('account-3', 'marc@example.org', {
        state: 'invited',
        lastSyncAt: null,
      }),
      account('account-4', 'anne@example.org', {
        state: 'invited',
        lastSyncAt: null,
        invitationExpired: true,
      }),
      account('account-5', 'paul@example.org', { state: 'suspended' }),
    ]),
  },
};
