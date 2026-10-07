import type { Meta, StoryObj } from '@storybook/react-native';

import { LoadingState } from './LoadingState';

const meta = {
  title: 'Components/LoadingState',
  component: LoadingState,
} satisfies Meta<typeof LoadingState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
