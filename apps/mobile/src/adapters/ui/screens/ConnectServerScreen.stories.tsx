import type { Meta, StoryObj } from '@storybook/react-native';

import {
  ConnectServerForm,
  ConnectServerScreen,
  connectErrorText,
} from './ConnectServerScreen';

const meta = {
  title: 'Screens/ConnectServer',
  component: ConnectServerScreen,
} satisfies Meta<typeof ConnectServerScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

const noop = () => undefined;

/** The form as it is after a refusal: what was typed is kept, and the message is shown. */
const refused = (error: Parameters<typeof connectErrorText>[0]): Story => ({
  render: () => (
    <ConnectServerForm
      onBack={noop}
      address="courses.example.fr"
      onChangeAddress={noop}
      code="ABCD-EF23"
      onChangeCode={noop}
      deviceName="Pixel 8"
      onChangeDeviceName={noop}
      error={connectErrorText(error)}
      saving={false}
      onSubmit={noop}
    />
  ),
});

/** US4-6 */
export const ServerUnreachable: Story = refused({
  type: 'ServerUnreachable',
});

/** US4-5 */
export const InvalidCode: Story = refused({ type: 'InvalidCode' });

/** FR-019 */
export const UntrustedServer: Story = refused({ type: 'UntrustedServer' });

/** US4-12 */
export const TooManyAttempts: Story = refused({
  type: 'TooManyAttempts',
  minutesToWait: 7,
});
