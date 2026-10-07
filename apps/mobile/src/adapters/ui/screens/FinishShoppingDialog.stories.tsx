import type { Meta, StoryObj } from '@storybook/react-native';

import { FinishShoppingDialog } from './FinishShoppingDialog';

const meta = {
  title: 'Dialogs/FinishShoppingDialog',
  component: FinishShoppingDialog,
} satisfies Meta<typeof FinishShoppingDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    visible: true,
    onCancel: () => undefined,
    onConfirm: () => undefined,
  },
};
