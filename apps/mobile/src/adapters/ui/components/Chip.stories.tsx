import type { Meta, StoryObj } from '@storybook/react-native';

import { Chip } from './Chip';

const meta = {
  title: 'Components/Chip',
  component: Chip,
} satisfies Meta<typeof Chip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Secondary: Story = {
  args: { tone: 'secondary', children: '3 restants' },
};

export const Tertiary: Story = {
  args: { tone: 'tertiary', icon: 'check', children: 'Déjà dans la liste' },
};

export const Brand: Story = {
  args: { tone: 'brand', icon: 'check', children: 'en cours' },
};
