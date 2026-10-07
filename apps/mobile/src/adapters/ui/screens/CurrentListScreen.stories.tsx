import type { Meta, StoryObj } from '@storybook/react-native';

import { fixture } from '../testing/fixtures';
import { CurrentListScreen } from './CurrentListScreen';

const meta = {
  title: 'Screens/CurrentList',
  component: CurrentListScreen,
} satisfies Meta<typeof CurrentListScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

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
