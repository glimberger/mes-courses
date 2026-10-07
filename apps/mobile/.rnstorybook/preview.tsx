import type { Preview } from '@storybook/react-native';

import { withAppProviders } from '../src/adapters/ui/testing/story-decorator';

const preview: Preview = {
  decorators: [withAppProviders],
};

export default preview;
