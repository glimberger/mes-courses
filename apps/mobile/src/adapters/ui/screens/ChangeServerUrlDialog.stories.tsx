import type { Meta, StoryObj } from '@storybook/react-native';

import { fixture } from '../testing/fixtures';
import {
  ChangeServerUrlDialog,
  ChangeServerUrlDialogForm,
  changeUrlErrorText,
} from './ChangeServerUrlDialog';

const meta = {
  title: 'Dialogs/ChangeServerUrlDialog',
  component: ChangeServerUrlDialog,
  args: { currentUrl: 'https://courses.example.fr', onClose: () => undefined },
  parameters: { scenario: { seed: fixture } },
} satisfies Meta<typeof ChangeServerUrlDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

const noop = () => undefined;

export const Default: Story = {};

/** The new address answers, but as another server (FR-016). */
export const ServerMismatch: Story = {
  render: () => (
    <ChangeServerUrlDialogForm
      address="autre.example.fr"
      onChangeAddress={noop}
      error={changeUrlErrorText({ type: 'ServerMismatch' })}
      saving={false}
      onClose={noop}
      onSubmit={noop}
    />
  ),
};
