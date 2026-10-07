import type { Meta, StoryObj } from '@storybook/react-native';

import { CrashError } from './CrashError';

// No store scenario: the app replaced by this screen has dropped its store.
const meta = {
  title: 'Screens/Crash',
  component: CrashError,
  parameters: { withoutStore: true },
} satisfies Meta<typeof CrashError>;

export default meta;

type Story = StoryObj<typeof meta>;

const Crashed: Story = { args: { onRetry: () => undefined } };

// Exported under the state's name without hiding the global `Error` in this file.
export { Crashed as Error };
