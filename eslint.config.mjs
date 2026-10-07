import js from '@eslint/js';
import globals from 'globals';
import expoConfig from 'eslint-config-expo/flat.js';
import prettier from 'eslint-config-prettier';
import reactNative from 'eslint-plugin-react-native';
import tseslint from 'typescript-eslint';

const APP = 'apps/mobile/**';

// Scope a shared flat config to the app workspace. A config object that already has `files`
// is narrowed with a nested array (logical AND); global-ignore objects are kept as they are.
const scopeToApp = (configs) =>
  configs.map((config) => {
    const isGlobalIgnore = Object.keys(config).every((field) =>
      ['ignores', 'name'].includes(field),
    );
    if (isGlobalIgnore) return config;
    return {
      ...config,
      files: config.files
        ? config.files.map((pattern) => [APP, pattern])
        : [`${APP}/*.{js,jsx,mjs,cjs,ts,tsx}`],
    };
  });

// What a screen may style (research R2): layout only, with spacing tokens.
const ALLOWED_SCREEN_STYLE_KEYS =
  '^(flex|flexDirection|flexGrow|flexShrink|flexWrap|alignItems|alignSelf|justifyContent|position|margin\\w*|padding\\w*|gap)$';
const STYLE_PROPERTY =
  'CallExpression[callee.object.name="StyleSheet"][callee.property.name="create"] > ObjectExpression > Property > ObjectExpression > Property';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.expo/**',
      '**/ios/**',
      '**/android/**',
      '**/coverage/**',
      '**/artifacts/**',
      '.yarn/**',
      '**/storybook.requires.ts',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strict,
  ...scopeToApp(expoConfig),
  {
    files: [`${APP}/*.{ts,tsx}`],
    plugins: { 'react-native': reactNative },
    rules: {
      'react-native/no-color-literals': 'error',
      'react-native/no-inline-styles': 'error',
    },
  },
  {
    files: ['apps/mobile/src/adapters/ui/screens/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', '**/*.stories.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `${STYLE_PROPERTY}:not([key.name=/${ALLOWED_SCREEN_STYLE_KEYS}/])`,
          message:
            'A screen styles layout only (flex, alignment, position, margin, padding, gap from spacing tokens). Anything visual belongs to a shared component.',
        },
        {
          selector: `${STYLE_PROPERTY}[key.name=/^(margin|padding|gap)/] > Literal[value!=0]`,
          message: 'Use a spacing token (spacing.*), not a number literal.',
        },
      ],
    },
  },
  {
    // CommonJS tool configuration files.
    files: ['**/*.cjs', '**/*.config.js'],
    languageOptions: { globals: globals.node },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['apps/mobile/src/**/*.{ts,tsx}'],
    rules: { 'no-console': 'error' },
  },
  {
    // The console reporter is used only when no DSN is set; it logs report fields, never list content.
    files: [
      'apps/mobile/src/adapters/error-reporting/console-error-reporter.ts',
    ],
    rules: { 'no-console': 'off' },
  },
  prettier,
);
