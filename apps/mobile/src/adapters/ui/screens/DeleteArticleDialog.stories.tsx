import type { Meta, StoryObj } from '@storybook/react-native';

import type { ArticleId, ArticleUsage } from '../../../domain/article';
import type { ListId } from '../../../domain/shopping-list';
import { fixture } from '../testing/fixtures';
import { DeleteArticleDialog } from './DeleteArticleDialog';

const meta = {
  title: 'Dialogs/DeleteArticleDialog',
  component: DeleteArticleDialog,
  args: { onClose: () => undefined },
  parameters: { scenario: { seed: fixture } },
} satisfies Meta<typeof DeleteArticleDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

const usageOn = (names: string[]): ArticleUsage => ({
  article: { id: 'article-lait' as ArticleId, name: 'Lait' },
  lists: names.map((name) => ({ id: `list-${name}` as ListId, name })),
});

export const NoList: Story = { args: { usage: usageOn([]) } };

export const OneList: Story = { args: { usage: usageOn(['Ma liste']) } };

export const SeveralLists: Story = {
  args: { usage: usageOn(['Barbecue', 'Ma liste', 'Pique-nique']) },
};
