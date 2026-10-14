import type { Meta, StoryObj } from '@storybook/react-native';

import { fixture } from '../testing/fixtures';
import {
  ChangePasswordDialog,
  ChangePasswordDialogForm,
  changePasswordErrors,
} from './ChangePasswordDialog';

const meta = {
  title: 'Dialogs/ChangePasswordDialog',
  component: ChangePasswordDialog,
  args: { onClose: () => undefined },
  parameters: { scenario: { seed: fixture } },
} satisfies Meta<typeof ChangePasswordDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

const noop = () => undefined;

const refused = (error: Parameters<typeof changePasswordErrors>[0]): Story => ({
  render: () => (
    <ChangePasswordDialogForm
      current="mot de passe actuel"
      onChangeCurrent={noop}
      next="nouveau mot de passe"
      onChangeNext={noop}
      confirmation="nouveau mot de passe"
      onChangeConfirmation={noop}
      errors={changePasswordErrors(error)}
      saving={false}
      onClose={noop}
      onSubmit={noop}
    />
  ),
});

export const Default: Story = {};

/** US6-2 */
export const WrongCurrent: Story = refused({ type: 'InvalidCredentials' });

/** The same password again is told locally (US6-2). */
export const SameAsCurrent: Story = refused({
  type: 'PasswordRejected',
  problem: 'SameAsCurrent',
});
