import type { Meta, StoryObj } from '@storybook/react-native';

import { fixture } from '../testing/fixtures';
import { EditListDialog, EditListDialogForm } from './EditListDialog';

const barbecue = fixture.lists.find((list) => list.name === 'Barbecue');
if (!barbecue) throw new Error('The fixture has no "Barbecue"');

const meta = {
  title: 'Dialogs/EditListDialog',
  component: EditListDialog,
  args: { list: barbecue, onClose: () => undefined },
  parameters: { scenario: { seed: fixture } },
} satisfies Meta<typeof EditListDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

const noop = () => undefined;

/** "ma liste" typed while "Ma liste" exists. */
export const NameError: Story = {
  render: () => (
    <EditListDialogForm
      name="ma liste"
      onChangeName={noop}
      error="Une liste porte déjà ce nom."
      saving={false}
      onClose={noop}
      onSubmit={noop}
    />
  ),
};
