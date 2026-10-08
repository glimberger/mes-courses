import type { Meta, StoryObj } from '@storybook/react-native';

import { fixture } from '../testing/fixtures';
import { CreateArticleForm, CreateArticleScreen } from './CreateArticleScreen';

const meta = {
  title: 'Screens/CreateArticle',
  component: CreateArticleScreen,
  parameters: { scenario: { seed: fixture } },
} satisfies Meta<typeof CreateArticleScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

const noop = () => undefined;

/** "lait" typed in Crèmerie: the form offers to add "Lait" instead (US2-9). */
export const NameAlreadyUsed: Story = {
  render: () => (
    <CreateArticleForm
      onBack={noop}
      name="lait"
      onChangeName={noop}
      nameError="« Lait » existe déjà."
      existingName="Lait"
      onAddExisting={noop}
      amount=""
      unit=""
      onChangeAmount={noop}
      onChangeUnit={noop}
      quantityError={null}
      categoryId={fixture.articles[0]?.categoryId ?? null}
      onChooseCategory={noop}
      onNewCategory={noop}
      categoryMissing={false}
      saving={false}
      onSubmit={noop}
    />
  ),
};
