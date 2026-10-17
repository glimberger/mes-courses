import type { Meta, StoryObj } from '@storybook/react-native';

import type { ListId } from '../../../domain/shopping-list';
import { fixture } from '../testing/fixtures';
import { ListsScreen } from './ListsScreen';

const meta = {
  title: 'Screens/Lists',
  component: ListsScreen,
} satisfies Meta<typeof ListsScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  parameters: { scenario: { seed: fixture, pending: ['getLists'] } },
};

const LoadFailed: Story = {
  parameters: { scenario: { seed: fixture, failing: ['getLists'] } },
};

// Exported under the state's name without hiding the global `Error` in this file.
export { LoadFailed as Error };

/** "Barbecue", empty, and "Ma liste", current with four items. */
export const Success: Story = {
  parameters: { scenario: { seed: fixture } },
};

/** Mockup 2: three lists, the middle one current, each a card. */
export const ThreeListsOneCurrent: Story = {
  parameters: {
    scenario: {
      seed: {
        ...fixture,
        lists: [
          ...fixture.lists,
          { id: 'list-noel' as ListId, name: 'Noël en famille' },
        ],
      },
    },
  },
};

/** A single list, shown as one card. */
export const OneList: Story = {
  parameters: {
    scenario: {
      seed: { ...fixture, lists: [fixture.lists[0]] },
    },
  },
};

/** No lists yet: the empty state leaves room and the FAB offers creating one. */
export const Empty: Story = {
  parameters: {
    scenario: {
      seed: { ...fixture, lists: [], items: [], currentListId: null },
    },
  },
};
