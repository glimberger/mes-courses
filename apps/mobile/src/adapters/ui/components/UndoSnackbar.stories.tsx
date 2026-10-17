import type { Meta, StoryObj } from '@storybook/react-native';

import type { ArticleId } from '../../../domain/article';
import { fixture } from '../testing/fixtures';
import type { StoryScenario } from '../testing/story-store';
import { UndoSnackbar } from './UndoSnackbar';

const meta = {
  title: 'Components/UndoSnackbar',
  component: UndoSnackbar,
} satisfies Meta<typeof UndoSnackbar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** "Lait" removed from the current list, as from its row. */
const removeLait: StoryScenario['prepare'] = async (store) => {
  await store.loadCurrentList();
  await store.removeItem('article-lait' as ArticleId);
};

export const RemovedItem: Story = {
  parameters: { scenario: { seed: fixture, prepare: removeLait } },
};

/** "Lait" deleted from the catalog, as from the delete dialog. */
const deleteLait: StoryScenario['prepare'] = async (store) => {
  await store.loadCurrentList();
  await store.deleteArticle('article-lait' as ArticleId);
};

export const DeletedArticle: Story = {
  parameters: { scenario: { seed: fixture, prepare: deleteLait } },
};

/** Mockup 12: the undo offer above the screen's FAB. */
export const AboveFab: Story = {
  parameters: { scenario: { seed: fixture, prepare: removeLait } },
};

/** Mockup 13: the same offer in dark appearance. */
export const AboveFabDark: Story = {
  parameters: {
    scenario: { seed: fixture, prepare: removeLait },
    appearance: 'dark',
  },
};
