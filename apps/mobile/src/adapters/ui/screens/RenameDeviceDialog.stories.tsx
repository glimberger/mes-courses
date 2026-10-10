import type { Meta, StoryObj } from '@storybook/react-native';

import { fixture } from '../testing/fixtures';
import { RenameDeviceDialog } from './RenameDeviceDialog';

const meta = {
  title: 'Dialogs/RenameDeviceDialog',
  component: RenameDeviceDialog,
  args: {
    device: { id: 'device-2', name: 'iPhone de Marc' },
    onClose: () => undefined,
  },
  parameters: { scenario: { seed: fixture } },
} satisfies Meta<typeof RenameDeviceDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
