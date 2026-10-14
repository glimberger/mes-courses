import type { Meta, StoryObj } from '@storybook/react-native';

import {
  ForgotPasswordDialog,
  ForgotPasswordDialogForm,
  resetFailureText,
} from './ForgotPasswordDialog';

const meta = {
  title: 'Dialogs/ForgotPasswordDialog',
  component: ForgotPasswordDialog,
  args: {
    address: 'courses.example.fr',
    initialEmail: 'marie@example.org',
    onClose: () => undefined,
  },
} satisfies Meta<typeof ForgotPasswordDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

const noop = () => undefined;

const shown = (error: string | null, sent = false): Story => ({
  render: () => (
    <ForgotPasswordDialogForm
      email="marie@example.org"
      onChangeEmail={noop}
      error={error}
      sent={sent}
      sending={false}
      onClose={noop}
      onSubmit={noop}
    />
  ),
});

export const Default: Story = {};

/** The same text whether or not the account exists (US4-1, US4-3). */
export const Sent: Story = shown(null, true);

/** US4-4 */
export const TooManyAttempts: Story = shown(
  resetFailureText({ type: 'TooManyAttempts', minutesToWait: 42 }),
);
