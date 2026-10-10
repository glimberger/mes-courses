import type { Meta, StoryObj } from '@storybook/react-native';

import { fixture } from '../testing/fixtures';
import { DisconnectDialog } from './DisconnectDialog';

const meta = {
  title: 'Dialogs/DisconnectDialog',
  component: DisconnectDialog,
  args: { onClose: () => undefined },
  parameters: { scenario: { seed: fixture } },
} satisfies Meta<typeof DisconnectDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
