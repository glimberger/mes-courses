import type { Meta, StoryObj } from '@storybook/react-native';

import type { ArticleId } from '../../../domain/article';
import { fixture } from '../testing/fixtures';
import { QuantityDialog, QuantityDialogForm } from './QuantityDialog';

const meta = {
  title: 'Dialogs/QuantityDialog',
  component: QuantityDialog,
  args: { onClose: () => undefined },
  parameters: { scenario: { seed: fixture } },
} satisfies Meta<typeof QuantityDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

const article = (name: string) => ({
  id: `article-${name.toLowerCase()}` as ArticleId,
  name,
});

export const Add: Story = {
  args: { request: { mode: 'add', article: article('Beurre') } },
};

export const Edit: Story = {
  args: {
    request: {
      mode: 'edit',
      article: article('Farine'),
      quantity: { amount: 1.5, unit: 'kg' },
    },
  },
};

export const AlreadyOnList: Story = {
  args: {
    request: {
      mode: 'alreadyOnList',
      article: article('Lait'),
      quantity: { amount: 2, unit: 'L' },
    },
  },
};

const noop = () => undefined;

/** "0" typed: the amount is refused (US2-12). */
export const InvalidAmount: Story = {
  args: { request: null },
  render: () => (
    <QuantityDialogForm
      name="Beurre"
      mode="add"
      amount="0"
      unit=""
      onChangeAmount={noop}
      onChangeUnit={noop}
      error={{ type: 'AmountNotPositive' }}
      saving={false}
      onClose={noop}
      onClear={noop}
      onSubmit={noop}
    />
  ),
};
