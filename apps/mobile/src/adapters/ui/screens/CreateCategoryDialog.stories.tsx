import type { Meta, StoryObj } from '@storybook/react-native';

import { fixture } from '../testing/fixtures';
import {
  CreateCategoryDialog,
  CreateCategoryDialogForm,
  NAME_ALREADY_USED,
} from './CreateCategoryDialog';

const meta = {
  title: 'Dialogs/CreateCategoryDialog',
  component: CreateCategoryDialog,
  args: { visible: true, onClose: () => undefined },
  parameters: { scenario: { seed: fixture } },
} satisfies Meta<typeof CreateCategoryDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

const noop = () => undefined;

/** "boissons" typed while "Boissons" exists (US4-3). */
export const NameAlreadyUsed: Story = {
  render: () => (
    <CreateCategoryDialogForm
      name="boissons"
      onChangeName={noop}
      error={NAME_ALREADY_USED}
      saving={false}
      onClose={noop}
      onSubmit={noop}
    />
  ),
};
