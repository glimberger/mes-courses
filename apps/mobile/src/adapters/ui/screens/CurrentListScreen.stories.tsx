import type { Meta, StoryObj } from '@storybook/react-native';

import { StyleSheet, View } from 'react-native';

import { err } from '../../../domain/result';
import { SyncStatusLine } from '../components/SyncStatusLine';
import { TabBar } from '../components/TabBar';
import { fixture } from '../testing/fixtures';
import type { StoreActions } from '../testing/story-store';
import { CurrentListScreen } from './CurrentListScreen';

const meta = {
  title: 'Screens/CurrentList',
  component: CurrentListScreen,
} satisfies Meta<typeof CurrentListScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1 },
});

export const Loading: Story = {
  parameters: { scenario: { seed: fixture, pending: ['getCurrentList'] } },
};

const LoadFailed: Story = {
  parameters: { scenario: { seed: fixture, failing: ['getCurrentList'] } },
};

// Exported under the state's name without hiding the global `Error` in this file.
export { LoadFailed as Error };

export const Empty: Story = {
  parameters: { scenario: { seed: { ...fixture, items: [] } } },
};

/** Several categories, with ticked, unticked and quantified items. */
export const Success: Story = {
  parameters: { scenario: { seed: fixture } },
};

export const AllInCart: Story = {
  parameters: {
    scenario: {
      seed: {
        ...fixture,
        items: fixture.items.map((item) => ({ ...item, inCart: true })),
      },
    },
  },
};

/** The sync line above the tab bar, here after three failing cycles (FR-020). */
export const WithSyncLine: Story = {
  parameters: {
    scenario: {
      seed: fixture,
      connected: { lastSyncAt: null },
      syncServer: { sync: async () => err({ type: 'ServerError' }) },
      prepare: async (store: StoreActions) => {
        await store.syncNow();
        await store.syncNow();
        await store.syncNow();
      },
    },
  },
  render: () => (
    <View style={styles.screen}>
      <View style={styles.content}>
        <CurrentListScreen />
      </View>
      <SyncStatusLine />
      <TabBar
        tabs={[
          { key: 'courses', label: 'Courses', icon: 'shopping_cart' },
          { key: 'lists', label: 'Listes', icon: 'format_list_bulleted' },
          { key: 'articles', label: 'Articles', icon: 'grocery' },
          { key: 'settings', label: 'Réglages', icon: 'settings' },
        ]}
        selectedKey="courses"
        onSelect={() => undefined}
      />
    </View>
  ),
};

/** Long names wrap without clipping at the requested text scales (SC-006). */
export const LongNames: Story = {
  parameters: { scenario: { seed: fixture } },
};

/** Mockup 6: the current list in dark appearance. */
export const SuccessDark: Story = {
  parameters: { scenario: { seed: fixture }, appearance: 'dark' },
};
