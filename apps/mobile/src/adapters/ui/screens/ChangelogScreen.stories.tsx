import type { Meta, StoryObj } from '@storybook/react-native';

import { ChangelogProvider } from '../changelog-context';
import { ChangelogScreen } from './ChangelogScreen';

const meta = {
  title: 'Screens/Changelog',
  component: ChangelogScreen,
} satisfies Meta<typeof ChangelogScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

const releases = [
  {
    version: '2.1.0',
    date: '2026-11-09',
    features: [
      { text: 'rename and delete a shopping list from the lists screen' },
    ],
    fixes: [],
  },
  {
    version: '2.0.1',
    date: '2026-11-07',
    features: [
      { text: 'bottom tab navigation with nested stacks' },
      { text: 'Articles tab for global catalog management' },
    ],
    fixes: [{ text: 'keep the keyboard closed after adding an article' }],
  },
];

/** Two releases, newest first, with their "Nouveautés" and "Corrections". */
export const Default: Story = {
  decorators: [
    (Story) => (
      <ChangelogProvider value={releases}>
        <Story />
      </ChangelogProvider>
    ),
  ],
};

/** An empty or missing changelog: a message instead of a list. */
export const Empty: Story = {};
