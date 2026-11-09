import type { Meta, StoryObj } from '@storybook/react-native';

import { fixture } from '../testing/fixtures';
import { DeleteListDialog } from './DeleteListDialog';

const barbecue = fixture.lists.find((list) => list.name === 'Barbecue');
if (!barbecue) throw new Error('The fixture has no "Barbecue"');

const meta = {
  title: 'Dialogs/DeleteListDialog',
  component: DeleteListDialog,
  args: { list: barbecue, onClose: () => undefined },
  parameters: { scenario: { seed: fixture } },
} satisfies Meta<typeof DeleteListDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Mockup 28 in dark appearance. */
export const DefaultDark: Story = {
  parameters: { ...meta.parameters, appearance: 'dark' },
};
