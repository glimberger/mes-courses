/**
 * Architecture rules (research R15). Run from the root with `yarn test:architecture`.
 * Paths are relative to the repository root.
 */

// Workspace packages that are pure (no framework, no side effects, importing only other pure
// packages). Domain and application code may import them. Empty in 001: 003 adds
// `packages/sync-core`.
const PURE_PACKAGES = [];

const pure =
  PURE_PACKAGES.length > 0 ? `|^packages/(${PURE_PACKAGES.join('|')})/` : '';

const MOBILE_SRC = '^apps/mobile/src';

const STORIES = '\\.stories\\.tsx$';
const STORYBOOK_CONFIG = '^apps/mobile/\\.rnstorybook/';
const TESTING_FOLDERS = `${MOBILE_SRC}/(adapters/ui|application)/testing/|^apps/mobile/test/`;
const STORYBOOK_IMPORTERS = `${STORIES}|${STORYBOOK_CONFIG}|^apps/mobile/metro\\.config\\.js$|^apps/mobile/src/adapters/ui/stories\\.test\\.tsx$`;
const TESTING_FILES = `${STORIES}|${TESTING_FOLDERS}`;
const TESTING_IMPORTERS = `\\.test\\.tsx?$|${STORIES}|${STORYBOOK_CONFIG}|${TESTING_FOLDERS}`;

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-relative-import-across-workspaces',
      severity: 'error',
      comment:
        'A workspace is reached through its package name, never through a relative path (Principle XI).',
      from: { path: '^(apps|packages|tests)/([^/]+)/' },
      to: {
        dependencyTypes: ['local'],
        path: '^(apps|packages|tests)/',
        pathNot: '^$1/$2/',
      },
    },
    {
      name: 'no-app-imports-another-app',
      severity: 'error',
      comment: 'An app workspace (apps/*) never imports another app workspace.',
      from: { path: '^apps/([^/]+)/' },
      to: { path: '^apps/', pathNot: '^apps/$1/' },
    },
    {
      name: 'domain-imports-nothing-outside-domain',
      severity: 'error',
      comment:
        'The domain imports only itself: no npm package, not even a type-only import (a pure workspace package is the only exception).',
      from: { path: `${MOBILE_SRC}/domain/` },
      to: { pathNot: `${MOBILE_SRC}/domain/${pure}` },
    },
    {
      name: 'application-imports-only-domain-and-application',
      severity: 'error',
      comment:
        'The application layer imports the domain and itself only, no npm package, not even a type-only import (a pure workspace package is the only exception).',
      from: { path: `${MOBILE_SRC}/application/` },
      to: { pathNot: `${MOBILE_SRC}/(domain|application)/${pure}` },
    },
    {
      name: 'adapters-imported-only-by-composition-and-adapters',
      severity: 'error',
      comment:
        'Only adapters, the composition root, App.tsx and its test, and the adapter test helpers import adapters. Storybook configuration (.rnstorybook/) builds the story theme from the UI adapter, so it is allowed too.',
      from: {
        pathNot:
          '^apps/mobile/(src/adapters/|src/composition/|App\\.(test\\.)?tsx$|test/|\\.rnstorybook/)',
      },
      to: { path: `${MOBILE_SRC}/adapters/` },
    },
    {
      name: 'no-adapter-imports-another-adapter',
      severity: 'error',
      comment:
        'Adapters never import each other, not even types: shared errors are declared with the ports.',
      from: { path: `${MOBILE_SRC}/adapters/([^/]+)/` },
      to: {
        path: `${MOBILE_SRC}/adapters/`,
        pathNot: `${MOBILE_SRC}/adapters/$1/`,
      },
    },
    {
      name: 'composition-imported-only-by-the-entry',
      severity: 'error',
      comment:
        'The composition root is the only code that knows every adapter.',
      from: {
        pathNot: '^apps/mobile/(App\\.tsx|App\\.test\\.tsx|src/composition/)',
      },
      to: { path: `${MOBILE_SRC}/composition/` },
    },
    {
      name: 'zustand-only-in-the-ui-adapter',
      severity: 'error',
      comment:
        'Zustand is imported only under apps/mobile/src/adapters/ui/ (research R10).',
      from: { pathNot: `${MOBILE_SRC}/adapters/ui/` },
      to: { path: '(^|node_modules/)zustand(/|$)' },
    },
    {
      name: 'no-zustand-middleware-no-immer',
      severity: 'error',
      comment:
        'Neither zustand/middleware nor immer is used anywhere (002 research R1b).',
      from: {},
      to: {
        path: '(^|node_modules/)(zustand/(esm/)?middleware|immer)(/|\\.|$)',
      },
    },
    {
      name: 'storybook-only-in-stories-and-its-config',
      severity: 'error',
      comment:
        'Storybook is imported only by story files, apps/mobile/.rnstorybook/, its Metro wrapper and the story test (research R22).',
      from: {
        pathNot: `${STORYBOOK_IMPORTERS}`,
      },
      to: { path: 'node_modules/(@storybook/|storybook/)' },
    },
    {
      name: 'testing-helpers-never-imported-by-production-code',
      severity: 'error',
      comment:
        'Stories and testing helpers are imported only by tests, stories, apps/mobile/.rnstorybook/ and other testing helpers (research R22).',
      from: { pathNot: `${TESTING_IMPORTERS}` },
      to: { path: `${TESTING_FILES}` },
    },
    {
      name: 'e2e-imports-no-other-workspace',
      severity: 'error',
      comment:
        'The end-to-end tests only drive the built binary: they import no other workspace, by path or by package name (research R23).',
      from: { path: '^tests/e2e/' },
      to: {
        path: '^(apps|packages)/|^tests/(?!e2e/)|node_modules/@mes-courses/',
      },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'No circular dependency.',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: {
      // Build output of a workspace only: an npm package's own dist/ folder must stay in the graph.
      path: '^(apps|packages|tests)/[^/]+/(dist|\\.expo|ios|android|coverage|artifacts)/',
    },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['main', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
