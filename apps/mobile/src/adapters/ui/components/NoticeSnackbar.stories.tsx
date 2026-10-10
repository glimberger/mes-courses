import type { Meta, StoryObj } from '@storybook/react-native';

import type { ServerRow } from '@mes-courses/sync-core';

import type { ArticleId } from '../../../domain/article';
import { fixture } from '../testing/fixtures';
import {
  OTHER_DEVICE_HLC,
  pullingSyncServer,
} from '../testing/pulling-sync-server';
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

const stamp = OTHER_DEVICE_HLC;

/** A device connected to a server that sends `rows` at the first cycle, as another device would. */
const pulling = (rows: ServerRow[]): StoryScenario => {
  const { syncServer, send } = pullingSyncServer();
  send(rows);
  return {
    seed: fixture,
    connected: { serverUrl: 'https://courses.example.fr', lastSyncAt: null },
    syncServer,
  };
};

// The pull reaches the store, then the open form announces what it removed (FR-020a).
export const ArticleDeletedElsewhere: Story = {
  parameters: {
    scenario: {
      ...pulling([
        {
          kind: 'article',
          id: 'article-lait',
          seq: 1,
          fields: {
            name: { value: 'Lait', hlc: stamp },
            categoryId: { value: 'category-0', hlc: stamp },
          },
          createdHlc: stamp,
          deletedHlc: stamp,
          mergedInto: null,
        },
      ]),
      prepare: async (store) => {
        await store.syncNow();
        store.noticeRemoteRemoval('articleDeleted');
      },
    } satisfies StoryScenario,
  },
};

export const ItemRemovedElsewhere: Story = {
  parameters: {
    scenario: {
      ...pulling([
        {
          kind: 'listItem',
          id: 'list-ma-liste:article-lait',
          seq: 1,
          fields: {
            listId: { value: 'list-ma-liste', hlc: stamp },
            articleId: { value: 'article-lait', hlc: stamp },
            present: { value: false, hlc: stamp },
            inCart: { value: false, hlc: stamp },
            quantity: { value: null, hlc: stamp },
          },
          createdHlc: stamp,
          deletedHlc: null,
          mergedInto: null,
        },
      ]),
      prepare: async (store) => {
        await store.syncNow();
        store.noticeRemoteRemoval('itemRemoved');
      },
    } satisfies StoryScenario,
  },
};
