import type { Meta, StoryObj } from '@storybook/react-native';

import { err } from '../../../domain/result';
import { fixture } from '../testing/fixtures';
import type { StoryScenario } from '../testing/story-store';
import { SyncStatusLine } from './SyncStatusLine';

const meta = {
  title: 'Components/SyncStatusLine',
  component: SyncStatusLine,
} satisfies Meta<typeof SyncStatusLine>;

export default meta;

type Story = StoryObj<typeof meta>;

const connected = {
  lastSyncAt: null,
};

/** Each state is reached through the store's actions against a fake server, never set by hand. */
const scenario = (
  rest: Partial<StoryScenario>,
): { scenario: StoryScenario } => ({
  scenario: { seed: fixture, connected, ...rest },
});

const failing = async (store: {
  syncNow: () => Promise<unknown>;
}): Promise<void> => {
  await store.syncNow();
  await store.syncNow();
  await store.syncNow();
};

/** Three failing cycles in a row. */
export const Failed: Story = {
  parameters: scenario({
    syncServer: { sync: async () => err({ type: 'ServerError' }) },
    prepare: failing,
  }),
};

/** Also what a phone restored from a backup shows (a server address with no credential). */
export const SignedOutRevoked: Story = {
  parameters: scenario({
    syncServer: { sync: async () => err({ type: 'DeviceNotAuthorized' }) },
  }),
};

export const SignedOutAccountDeleted: Story = {
  parameters: scenario({
    syncServer: { sync: async () => err({ type: 'AccountDeleted' }) },
  }),
};

export const UpdateRequired: Story = {
  parameters: scenario({
    syncServer: { sync: async () => err({ type: 'UpdateRequired' }) },
  }),
};

/** Not an error: neutral tone, the lists stay on the phone. */
export const Suspended: Story = {
  parameters: scenario({
    syncServer: { sync: async () => err({ type: 'AccountSuspended' }) },
  }),
};

export const FailedDark: Story = {
  parameters: {
    ...scenario({
      syncServer: { sync: async () => err({ type: 'ServerError' }) },
      prepare: failing,
    }),
    appearance: 'dark',
  },
};
