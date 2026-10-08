import type { Meta, StoryObj } from '@storybook/react-native';

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
