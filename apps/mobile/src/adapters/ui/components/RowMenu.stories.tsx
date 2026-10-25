import type { Meta, StoryObj } from '@storybook/react-native';

import { RowMenu } from './RowMenu';

const meta = {
  title: 'Components/RowMenu',
  component: RowMenu,
  args: {
    name: 'Lait',
    items: [
      {
        title: 'Quantité…',
        accessibilityLabel: 'Quantité de Lait',
        onPress: () => undefined,
      },
      {
        title: 'Retirer de la liste',
        accessibilityLabel: 'Retirer Lait de la liste',
        onPress: () => undefined,
      },
    ],
  },
} satisfies Meta<typeof RowMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const Open: Story = { args: { defaultVisible: true } };
