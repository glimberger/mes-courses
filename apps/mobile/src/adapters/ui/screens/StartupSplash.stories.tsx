import type { Meta, StoryObj } from '@storybook/react-native';

import { StartupSplash } from './StartupSplash';

const meta = {
  title: 'Screens/Startup',
  component: StartupSplash,
  parameters: { withoutStore: true },
} satisfies Meta<typeof StartupSplash>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Review with the device or simulator set to its light color scheme. */
export const Light: Story = {};

/** Review with the device or simulator set to its dark color scheme. */
export const Dark: Story = {};
