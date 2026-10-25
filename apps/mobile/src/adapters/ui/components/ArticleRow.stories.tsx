import type { Meta, StoryObj } from '@storybook/react-native';

import { ArticleRow } from './ArticleRow';

const meta = {
  title: 'Components/ArticleRow',
  component: ArticleRow,
  args: { onPress: () => undefined },
} satisfies Meta<typeof ArticleRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { name: 'Beurre', added: false },
};

export const Added: Story = {
  args: { name: 'Lait', added: true },
};
