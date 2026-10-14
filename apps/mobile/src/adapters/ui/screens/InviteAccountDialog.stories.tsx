import type { Meta, StoryObj } from '@storybook/react-native';

import { fixture } from '../testing/fixtures';
import {
  InviteAccountDialog,
  InviteAccountDialogForm,
  inviteFailureText,
} from './InviteAccountDialog';

const meta = {
  title: 'Dialogs/InviteAccountDialog',
  component: InviteAccountDialog,
  args: { onClose: () => undefined },
  parameters: { scenario: { seed: fixture } },
} satisfies Meta<typeof InviteAccountDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

const noop = () => undefined;

const refused = (email: string, type: string): Story => ({
  render: () => (
    <InviteAccountDialogForm
      email={email}
      onChangeEmail={noop}
      error={inviteFailureText(type)}
      sending={false}
      onClose={noop}
      onSubmit={noop}
    />
  ),
});

export const Default: Story = {};

/** The address already has an account (US1-2). */
export const AlreadyExists: Story = refused(
  'marie@example.org',
  'AccountExists',
);

/** The address is not one (US1-3). */
export const InvalidEmail: Story = refused('marie@', 'InvalidEmail');

/** The email could not be sent; nothing was created (US1-4). */
export const MailFailed: Story = refused('marie@example.org', 'MailFailed');
