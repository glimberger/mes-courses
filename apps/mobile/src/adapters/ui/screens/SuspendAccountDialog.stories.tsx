import type { Meta, StoryObj } from '@storybook/react-native';

import { fixture } from '../testing/fixtures';
import {
  AccountActionDialogForm,
  SUSPEND_LAST_ADMINISTRATOR,
  SuspendAccountDialog,
} from './AccountActionDialogs';

const meta = {
  title: 'Dialogs/SuspendAccountDialog',
  component: SuspendAccountDialog,
  args: {
    account: {
      id: 'account-2',
      email: 'marie@example.org',
      role: 'user',
      state: 'active',
      lastSyncAt: null,
      invitationExpired: false,
    },
    onClose: () => undefined,
  },
  parameters: { scenario: { seed: fixture } },
} satisfies Meta<typeof SuspendAccountDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The only administrator cannot suspend themselves (US5-5). */
export const LastAdministrator: Story = {
  render: () => (
    <AccountActionDialogForm
      title="Suspendre ce compte ?"
      body="admin@example.org ne pourra plus synchroniser. Ses données sont conservées."
      confirm="Suspendre"
      error={SUSPEND_LAST_ADMINISTRATOR}
      busy={false}
      onClose={() => undefined}
      onConfirm={() => undefined}
    />
  ),
};
