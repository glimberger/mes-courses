import type { Meta, StoryObj } from '@storybook/react-native';

import { UpdateRequired as UpdateRequiredScreen } from './UpdateRequired';

// No store scenario: the app has no store when it shows this screen.
const meta = {
  title: 'Screens/Startup',
  component: UpdateRequiredScreen,
  parameters: { withoutStore: true },
} satisfies Meta<typeof UpdateRequiredScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const UpdateRequired: Story = {};
