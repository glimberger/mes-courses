import type { Meta, StoryObj } from '@storybook/react-native';

import { StartupError } from './StartupError';

// No store scenario: the app has no store when it shows this screen.
const meta = {
  title: 'Screens/Startup',
  component: StartupError,
  parameters: { withoutStore: true },
} satisfies Meta<typeof StartupError>;

export default meta;

type Story = StoryObj<typeof meta>;

const StartupFailed: Story = { args: { onRetry: () => undefined } };

// Exported under the state's name without hiding the global `Error` in this file.
export { StartupFailed as Error };
