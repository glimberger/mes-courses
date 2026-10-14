import type { Meta, StoryObj } from '@storybook/react-native';

import { SignInForm, SignInScreen, signInErrorText } from './SignInScreen';

const meta = {
  title: 'Screens/SignIn',
  component: SignInScreen,
} satisfies Meta<typeof SignInScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

const noop = () => undefined;

/** The form as it is after a refusal: what was typed is kept, and the message is shown. */
const refused = (error: Parameters<typeof signInErrorText>[0]): Story => ({
  render: () => (
    <SignInForm
      onBack={noop}
      address="courses.example.fr"
      onChangeAddress={noop}
      email="marie@example.org"
      onChangeEmail={noop}
      password="secret"
      onChangePassword={noop}
      deviceName="Pixel 8"
      onChangeDeviceName={noop}
      error={signInErrorText(error)}
      saving={false}
      onSubmit={noop}
      onForgotPassword={noop}
    />
  ),
});

/** US2-4 */
export const InvalidCredentials: Story = refused({
  type: 'InvalidCredentials',
});

/** US2-5 */
export const TemporaryPasswordExpired: Story = refused({
  type: 'TemporaryPasswordExpired',
});

export const AccountSuspended: Story = refused({ type: 'AccountSuspended' });

export const TooManyAttempts: Story = refused({
  type: 'TooManyAttempts',
  minutesToWait: 7,
});

export const ServerUnreachable: Story = refused({ type: 'ServerUnreachable' });

/** FR-019 */
export const UntrustedServer: Story = refused({ type: 'UntrustedServer' });
