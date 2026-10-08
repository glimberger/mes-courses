import type { Meta, StoryObj } from '@storybook/react-native';

import { fixture } from '../testing/fixtures';
import type { StoryScenario } from '../testing/story-store';
import { EditArticleForm, EditArticleScreen } from './EditArticleScreen';

const catalogLoaded: StoryScenario['prepare'] = (store) => store.loadCatalog();

const lait = fixture.articles.find((article) => article.name === 'Lait');

const meta = {
  title: 'Screens/EditArticle',
  component: EditArticleScreen,
  parameters: {
    scenario: {
      seed: fixture,
      prepare: catalogLoaded,
    },
    routeParams: { articleId: lait?.id },
  },
} satisfies Meta<typeof EditArticleScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

const noop = () => undefined;

export const NameAlreadyUsed: Story = {
  render: () => (
    <EditArticleForm
      onBack={noop}
      name="beurre"
      onChangeName={noop}
      nameError="Un article « Beurre » existe déjà."
      saving={false}
      onSubmit={noop}
    />
  ),
};

export const NameRequired: Story = {
  render: () => (
    <EditArticleForm
      onBack={noop}
      name=""
      onChangeName={noop}
      nameError="Indiquez un nom."
      saving={false}
      onSubmit={noop}
    />
  ),
};
