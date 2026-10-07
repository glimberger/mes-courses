import { registerRootComponent } from 'expo';

// Storybook replaces the app only in a build made with STORYBOOK_ENABLED (see metro.config.js).
// Without it the flag is the constant 'false', so the bundle holds no Storybook code.
if (process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === 'true') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  registerRootComponent(require('./.rnstorybook').default);
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  registerRootComponent(require('./App').default);
}
