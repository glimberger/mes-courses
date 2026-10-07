import type { Meta, StoryObj } from '@storybook/react-native';

import { QuantityFields } from './QuantityFields';

const meta = {
  title: 'Components/QuantityFields',
  component: QuantityFields,
  args: {
    amount: '',
    unit: '',
    onChangeAmount: () => undefined,
    onChangeUnit: () => undefined,
    error: null,
  },
} satisfies Meta<typeof QuantityFields>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Filled: Story = {
  args: { amount: '1,5', unit: 'kg' },
};

export const WithError: Story = {
  args: { amount: '0', unit: 'kg', error: { type: 'AmountNotPositive' } },
};
