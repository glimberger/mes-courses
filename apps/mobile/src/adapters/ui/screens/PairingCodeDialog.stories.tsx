import type { Meta, StoryObj } from '@storybook/react-native';

import { ok } from '../../../domain/result';
import { fixture } from '../testing/fixtures';
import { PairingCodeDialog } from './PairingCodeDialog';

const meta = {
  title: 'Dialogs/PairingCodeDialog',
  component: PairingCodeDialog,
  args: { onClose: () => undefined },
} satisfies Meta<typeof PairingCodeDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

const connected = {
  serverUrl: 'https://courses.example.fr',
  lastSyncAt: null,
};

/** A code made by the server, with when it expires (US4-3). */
export const Code: Story = {
  parameters: {
    scenario: {
      seed: fixture,
      connected,
      syncServer: {
        createPairingCode: async () =>
          ok({
            code: 'ABCD-EF23',
            expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
          }),
      },
    },
  },
};

/** The server cannot be reached: a code needs it (US4-3). */
export const Offline: Story = {
  parameters: { scenario: { seed: fixture, connected } },
};
