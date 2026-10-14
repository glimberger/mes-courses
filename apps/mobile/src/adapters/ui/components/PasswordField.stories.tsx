import type { Meta, StoryObj } from '@storybook/react-native';

import { PasswordField } from './PasswordField';

const meta = {
  title: 'Components/PasswordField',
  component: PasswordField,
  args: {
    label: 'Mot de passe',
    value: 'secret',
    onChangeText: () => undefined,
    error: null,
  },
} satisfies Meta<typeof PasswordField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Hidden: Story = {};

export const WithError: Story = {
  args: {
    label: 'Nouveau mot de passe',
    error: 'Le mot de passe doit contenir au moins 12 caractères.',
  },
};
