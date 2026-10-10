import type { Meta, StoryObj } from '@storybook/react-native';

import { fixture } from '../testing/fixtures';
import { RevokeDeviceDialog } from './RevokeDeviceDialog';

const meta = {
  title: 'Dialogs/RevokeDeviceDialog',
  component: RevokeDeviceDialog,
  args: {
    device: { id: 'device-2', name: 'iPhone de Marc' },
    onClose: () => undefined,
  },
  parameters: { scenario: { seed: fixture } },
} satisfies Meta<typeof RevokeDeviceDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
