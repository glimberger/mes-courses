import type { Meta, StoryObj } from '@storybook/react-native';

import type { ArticleId } from '../../../domain/article';
import { fixture } from '../testing/fixtures';
import { DeleteArticleDialog } from './DeleteArticleDialog';

const meta = {
  title: 'Dialogs/DeleteArticle',
  component: DeleteArticleDialog,
  args: { onClose: () => undefined },
  parameters: { scenario: { seed: fixture } },
} satisfies Meta<typeof DeleteArticleDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

const lait = { id: 'article-lait' as ArticleId, name: 'Lait' };

export const NoList: Story = { args: { article: lait, count: 0 } };

export const OneList: Story = { args: { article: lait, count: 1 } };

export const SeveralLists: Story = { args: { article: lait, count: 3 } };

/** Mockup 24 in dark appearance. */
export const SeveralListsDark: Story = {
  ...SeveralLists,
  parameters: { ...SeveralLists.parameters, appearance: 'dark' },
};
