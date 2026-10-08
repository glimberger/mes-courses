import type { Meta, StoryObj } from '@storybook/react-native';

import { fixture } from '../testing/fixtures';
import { CreateListDialog, CreateListDialogForm } from './CreateListDialog';

const meta = {
  title: 'Dialogs/CreateListDialog',
  component: CreateListDialog,
  args: { visible: true, onClose: () => undefined },
  parameters: { scenario: { seed: fixture } },
} satisfies Meta<typeof CreateListDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

const noop = () => undefined;

/** "barbecue" typed while "Barbecue" exists (US3-5). */
export const NameAlreadyUsed: Story = {
  render: () => (
    <CreateListDialogForm
      name="barbecue"
      onChangeName={noop}
      error="Une liste porte déjà ce nom."
      saving={false}
      onClose={noop}
      onSubmit={noop}
    />
  ),
};
