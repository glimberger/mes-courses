import type { Meta, StoryObj } from '@storybook/react-native';

import { fixture } from '../testing/fixtures';
import { ResendCredentialsDialog } from './AccountActionDialogs';

const meta = {
  title: 'Dialogs/ResendCredentialsDialog',
  component: ResendCredentialsDialog,
  args: {
    account: {
      id: 'account-3',
      email: 'marc@example.org',
      role: 'user',
      state: 'invited',
      lastSyncAt: null,
      invitationExpired: false,
    },
    onClose: () => undefined,
  },
  parameters: { scenario: { seed: fixture } },
} satisfies Meta<typeof ResendCredentialsDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
