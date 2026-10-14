import type { Meta, StoryObj } from '@storybook/react-native';

import { fixture } from '../testing/fixtures';
import {
  AccountActionDialogForm,
  DELETE_LAST_ADMINISTRATOR,
  DeleteAccountDialog,
} from './AccountActionDialogs';

const meta = {
  title: 'Dialogs/DeleteAccountDialog',
  component: DeleteAccountDialog,
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
} satisfies Meta<typeof DeleteAccountDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The only administrator cannot delete themselves (US5-5). */
export const LastAdministrator: Story = {
  render: () => (
    <AccountActionDialogForm
      title="Supprimer ce compte ?"
      body="Le compte de admin@example.org et toutes ses listes seront supprimés du serveur, sans retour possible."
      confirm="Supprimer"
      destructive
      error={DELETE_LAST_ADMINISTRATOR}
      busy={false}
      onClose={() => undefined}
      onConfirm={() => undefined}
    />
  ),
};
