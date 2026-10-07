import type { Meta, StoryObj } from '@storybook/react-native';

import type { ArticleId } from '../../../domain/article';
import { fixture } from '../testing/fixtures';
import type { StoryScenario } from '../testing/story-store';
import { NoticeSnackbar } from './NoticeSnackbar';

const meta = {
  title: 'Components/NoticeSnackbar',
  component: NoticeSnackbar,
} satisfies Meta<typeof NoticeSnackbar>;

export default meta;

type Story = StoryObj<typeof meta>;

// The notice comes from a tick whose save fails, as on the current list.
const tickLait: StoryScenario['prepare'] = async (store) => {
  await store.loadCurrentList();
  await store.toggleItem('article-lait' as ArticleId);
};

export const WriteFailed: Story = {
  parameters: {
    scenario: {
      seed: fixture,
      failing: ['toggleItemInCart'],
      prepare: tickLait,
    },
  },
};

export const StorageFull: Story = {
  parameters: {
    scenario: {
      seed: fixture,
      failingWith: { toggleItemInCart: 'storageFull' },
      prepare: tickLait,
    },
  },
};
