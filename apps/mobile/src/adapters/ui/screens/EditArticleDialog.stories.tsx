import type { Meta, StoryObj } from '@storybook/react-native';

import { fixture } from '../testing/fixtures';
import { EditArticleDialog } from './EditArticleDialog';

const lait = fixture.articles.find((article) => article.name === 'Lait');
if (!lait) throw new Error('The fixture has no "Lait"');

const meta = {
  title: 'Dialogs/EditArticle',
  component: EditArticleDialog,
  args: { article: lait, onClose: () => undefined },
  parameters: { scenario: { seed: fixture } },
} satisfies Meta<typeof EditArticleDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoList: Story = { args: { count: 0 } };

export const OneList: Story = { args: { count: 1 } };

export const SeveralLists: Story = { args: { count: 3 } };

/** Mockup 22 in dark appearance. */
export const SeveralListsDark: Story = {
  ...SeveralLists,
  parameters: { ...SeveralLists.parameters, appearance: 'dark' },
};
