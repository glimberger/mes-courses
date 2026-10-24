import type { Meta, StoryObj } from '@storybook/react-native';

import { TabBar } from './TabBar';

const meta = {
  title: 'Components/TabBar',
  component: TabBar,
  args: {
    tabs: [
      { key: 'courses', label: 'Courses', icon: 'shopping_cart' },
      { key: 'lists', label: 'Listes', icon: 'format_list_bulleted' },
      { key: 'articles', label: 'Articles', icon: 'grocery' },
      { key: 'settings', label: 'Réglages', icon: 'settings' },
    ],
    selectedKey: 'courses',
    onSelect: () => undefined,
  },
} satisfies Meta<typeof TabBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Courses: Story = {};

export const Articles: Story = { args: { selectedKey: 'articles' } };
