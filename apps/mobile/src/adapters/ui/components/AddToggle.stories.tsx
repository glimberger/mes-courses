import type { Meta, StoryObj } from '@storybook/react-native';

import { AddToggle } from './AddToggle';

const meta = {
  title: 'Components/AddToggle',
  component: AddToggle,
} satisfies Meta<typeof AddToggle>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NotAdded: Story = { args: { added: false } };

export const Added: Story = { args: { added: true } };
