import type { Meta, StoryObj } from '@storybook/react-native';

import { EmptyCategoryCard } from './EmptyCategoryCard';

const meta = {
  title: 'Components/EmptyCategoryCard',
  component: EmptyCategoryCard,
  args: {
    message: 'Aucun article dans cette catégorie',
    actionLabel: 'Créer un article',
    onAction: () => undefined,
  },
} satisfies Meta<typeof EmptyCategoryCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
