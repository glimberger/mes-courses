import type { Meta, StoryObj } from '@storybook/react-native';

import { fixture } from '../testing/fixtures';
import { SignedOutNoticeDialog } from './SignedOutNoticeDialog';

const meta = {
  title: 'Dialogs/SignedOutNotice',
  component: SignedOutNoticeDialog,
  args: {
    reason: 'revoked',
    pendingCount: 0,
    onAcknowledge: () => undefined,
  },
  parameters: { scenario: { seed: fixture } },
} satisfies Meta<typeof SignedOutNoticeDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Revoked: Story = {};

export const AccountDeleted: Story = { args: { reason: 'accountDeleted' } };

export const PendingChangesLost: Story = { args: { pendingCount: 3 } };
