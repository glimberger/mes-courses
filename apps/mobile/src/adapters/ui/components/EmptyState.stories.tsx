import type { Meta, StoryObj } from '@storybook/react-native';

import { EmptyState } from './EmptyState';

const meta = {
  title: 'Components/EmptyState',
  component: EmptyState,
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithAction: Story = {
  args: {
    message: 'Votre liste est vide',
    action: { label: 'Ajouter des articles', onPress: () => undefined },
  },
};

export const WithoutAction: Story = {
  args: {
    message:
      "Cette version de l'application est trop ancienne pour vos données. Mettez-la à jour.",
  },
};
