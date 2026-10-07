import type { Meta, StoryObj } from '@storybook/react-native';

import { NameField } from './NameField';

const meta = {
  title: 'Components/NameField',
  component: NameField,
  args: { value: '', onChangeText: () => undefined, error: null },
} satisfies Meta<typeof NameField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithError: Story = {
  args: { value: '   ', error: 'Indiquez un nom.' },
};
