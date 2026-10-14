import type { Meta, StoryObj } from '@storybook/react-native';

import { fixture } from '../testing/fixtures';
import { SignOutDialog, SignOutDialogView } from './SignOutDialog';

const meta = {
  title: 'Dialogs/SignOutDialog',
  component: SignOutDialog,
  args: { onClose: () => undefined, onSignedOut: () => undefined },
  parameters: { scenario: { seed: fixture } },
} satisfies Meta<typeof SignOutDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Changes that never reached the server are lost: said before, with "Se déconnecter quand même" (US6-4). */
export const PendingChanges: Story = {
  render: () => (
    <SignOutDialogView
      pendingCount={3}
      saving={false}
      onClose={() => undefined}
      onConfirm={() => undefined}
    />
  ),
};
