const { getDefaultConfig } = require('expo/metro-config');
const {
  withStorybook,
} = require('@storybook/react-native/metro/withStorybook');

const enabled = process.env.STORYBOOK_ENABLED === 'true';

// The app reads the flag as EXPO_PUBLIC_STORYBOOK_ENABLED, the only prefix Expo inlines in the
// bundle, so a build without STORYBOOK_ENABLED drops the Storybook branch of index.ts.
process.env.EXPO_PUBLIC_STORYBOOK_ENABLED = enabled ? 'true' : 'false';

// The screenshot build (STORY_SHOTS=true) shows the stories one by one; the flag is inlined like
// the one above, so any other build drops that branch of index.ts.
process.env.EXPO_PUBLIC_STORY_SHOTS =
  enabled && process.env.STORY_SHOTS === 'true' ? 'true' : 'false';

module.exports = withStorybook(getDefaultConfig(__dirname), { enabled });
