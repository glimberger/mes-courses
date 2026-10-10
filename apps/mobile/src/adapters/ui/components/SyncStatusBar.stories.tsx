import type { Meta, StoryObj } from '@storybook/react-native';

import type { ArticleId } from '../../../domain/article';
import { err } from '../../../domain/result';
import { fixture } from '../testing/fixtures';
import { pullingSyncServer } from '../testing/pulling-sync-server';
import type { StoryScenario } from '../testing/story-store';
import { SyncStatusBar } from './SyncStatusBar';

const meta = {
  title: 'Components/SyncStatusBar',
  component: SyncStatusBar,
} satisfies Meta<typeof SyncStatusBar>;

export default meta;

type Story = StoryObj<typeof meta>;

const connected = {
  serverUrl: 'https://courses.example.fr',
  lastSyncAt: null,
};

/** Each status is reached through the store's actions against a fake server, never set by hand. */
const scenario = (
  rest: Partial<StoryScenario>,
): { scenario: StoryScenario } => ({
  scenario: { seed: fixture, connected, ...rest },
});

/** A cycle against a reachable server: nothing waits any more. */
export const Saved: Story = {
  parameters: scenario({
    syncServer: pullingSyncServer().syncServer,
    prepare: (store) => store.syncNow().then(() => undefined),
  }),
};

/** A change made while the server cannot be reached: waiting, and never in error colors. */
export const Waiting: Story = {
  parameters: scenario({
    prepare: async (store) => {
      await store.loadCurrentList();
      await store.toggleItem('article-lait' as ArticleId);
    },
  }),
};

export const Sending: Story = {
  parameters: scenario({ pending: ['synchronize'] }),
};

/** Three failing cycles in a row. */
export const Failed: Story = {
  parameters: scenario({
    syncServer: { sync: async () => err({ type: 'ServerError' }) },
    prepare: async (store) => {
      await store.syncNow();
      await store.syncNow();
    },
  }),
};

export const DisconnectedByServer: Story = {
  parameters: scenario({
    syncServer: { sync: async () => err({ type: 'DeviceNotAuthorized' }) },
  }),
};

export const UpdateRequired: Story = {
  parameters: scenario({
    syncServer: { sync: async () => err({ type: 'UpdateRequired' }) },
  }),
};
