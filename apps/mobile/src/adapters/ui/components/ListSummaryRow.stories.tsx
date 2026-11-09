import type { Meta, StoryObj } from '@storybook/react-native';

import { ListSummaryRow } from './ListSummaryRow';

const meta = {
  title: 'Components/ListSummaryRow',
  component: ListSummaryRow,
  args: {
    name: 'Barbecue',
    itemCount: 4,
    isCurrent: false,
    onPress: () => undefined,
    onEdit: () => undefined,
    onDelete: () => undefined,
  },
} satisfies Meta<typeof ListSummaryRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Current: Story = { args: { isCurrent: true } };

/** Mockup 26: the ⋮ menu open, with "Modifier" and "Supprimer". */
export const MenuOpen: Story = { args: { menuInitiallyOpen: true } };
