import type { Meta, StoryObj } from '@storybook/react-native';

import {
  ChoosePasswordForm,
  ChoosePasswordScreen,
  chooseErrorText,
} from './ChoosePasswordScreen';

const meta = {
  title: 'Screens/ChoosePassword',
  component: ChoosePasswordScreen,
} satisfies Meta<typeof ChoosePasswordScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

const noop = () => undefined;

const form = (
  error: Parameters<typeof chooseErrorText>[0] | null,
  password = 'a brand new password',
): Story => {
  const shown = error === null ? null : chooseErrorText(error);
  return {
    render: () => (
      <ChoosePasswordForm
        onBack={noop}
        newPassword={password}
        onChangeNewPassword={noop}
        confirmation={password}
        onChangeConfirmation={noop}
        error={shown?.text ?? null}
        canGoBackToSignIn={shown?.back ?? false}
        saving={false}
        onSubmit={noop}
      />
    ),
  };
};

export const Default: Story = form(null, '');

export const TooShort: Story = form(
  { type: 'PasswordRejected', problem: 'TooShort' },
  'short',
);

export const NotIdentical: Story = form({ type: 'PasswordsDiffer' });

export const SameAsTemporary: Story = form({
  type: 'PasswordRejected',
  problem: 'SameAsTemporary',
});

export const TemporaryPasswordInvalid: Story = form({
  type: 'TemporaryPasswordInvalid',
});
