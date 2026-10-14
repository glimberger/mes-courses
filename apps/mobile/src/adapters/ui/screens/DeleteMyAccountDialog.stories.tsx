import type { Meta, StoryObj } from '@storybook/react-native';

import { fixture } from '../testing/fixtures';
import {
  DeleteMyAccountDialog,
  DeleteMyAccountDialogForm,
  deleteMyAccountErrorText,
} from './DeleteMyAccountDialog';

const meta = {
  title: 'Dialogs/DeleteMyAccountDialog',
  component: DeleteMyAccountDialog,
  args: { onClose: () => undefined, onDeleted: () => undefined },
  parameters: { scenario: { seed: fixture } },
} satisfies Meta<typeof DeleteMyAccountDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

const refused = (type: 'InvalidCredentials' | 'LastAdministrator'): Story => ({
  render: () => (
    <DeleteMyAccountDialogForm
      password="mot de passe"
      onChangePassword={() => undefined}
      error={deleteMyAccountErrorText({ type })}
      saving={false}
      onClose={() => undefined}
      onConfirm={() => undefined}
    />
  ),
});

export const Default: Story = {};

/** US6-6 */
export const WrongPassword: Story = refused('InvalidCredentials');

/** The only administrator cannot delete themselves (US6-7). */
export const LastAdministrator: Story = refused('LastAdministrator');
