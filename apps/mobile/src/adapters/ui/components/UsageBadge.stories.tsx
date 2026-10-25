import type { Meta, StoryObj } from '@storybook/react-native';

import { UsageBadge } from './UsageBadge';

const meta = {
  title: 'Components/UsageBadge',
  component: UsageBadge,
} satisfies Meta<typeof UsageBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OneList: Story = { args: { name: 'Pommes', count: 1 } };

export const SeveralLists: Story = { args: { name: 'Carotte', count: 3 } };
