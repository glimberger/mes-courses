import type { Meta, StoryObj } from '@storybook/react-native';

import { Button } from './Button';

const meta = {
  title: 'Components/Button',
  component: Button,
  args: { children: 'Se connecter', onPress: () => undefined },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Brand: Story = { args: { mode: 'brand' } };

export const Outlined: Story = {
  args: { mode: 'outlined', icon: 'logout', children: 'Se déconnecter' },
};

export const Danger: Story = {
  args: { mode: 'danger', icon: 'delete', children: 'Supprimer mon compte' },
};

export const DangerFilled: Story = {
  args: { mode: 'dangerFilled', children: 'Supprimer' },
};

export const Text: Story = {
  args: { mode: 'text', children: 'Mot de passe oublié ?' },
};
