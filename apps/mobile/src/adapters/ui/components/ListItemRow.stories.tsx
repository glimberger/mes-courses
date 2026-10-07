import type { Meta, StoryObj } from '@storybook/react-native';

import { LONG_ARTICLE_NAME } from '../testing/fixtures';
import { ListItemRow } from './ListItemRow';

const meta = {
  title: 'Components/ListItemRow',
  component: ListItemRow,
  args: { onToggle: () => undefined },
} satisfies Meta<typeof ListItemRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NotInCart: Story = {
  args: { name: 'Beurre', quantity: null, inCart: false },
};

export const InCart: Story = {
  args: { name: 'Pommes', quantity: null, inCart: true },
};

export const WithQuantity: Story = {
  args: {
    name: 'Farine',
    quantity: { amount: 1.5, unit: 'kg' },
    inCart: false,
  },
};

export const LongName: Story = {
  args: { name: LONG_ARTICLE_NAME, quantity: null, inCart: false },
};
