import type { Meta, StoryObj } from '@storybook/react-native';

import { ErrorState } from './ErrorState';

const meta = {
  title: 'Components/ErrorState',
  component: ErrorState,
} satisfies Meta<typeof ErrorState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    message: 'Impossible de charger la liste.',
    onRetry: () => undefined,
  },
};
