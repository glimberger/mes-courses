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
        'Only adapters, the composition root, App.tsx and the adapter test helpers import adapters. Storybook configuration (.rnstorybook/) builds the story theme from the UI adapter, so it is allowed too.',
      from: {
        pathNot:
          '^apps/mobile/(src/adapters/|src/composition/|App\\.tsx$|test/|\\.rnstorybook/)',
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
      name: 'no-circular',
      severity: 'error',
      comment: 'No circular dependency.',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|\\.expo|ios|android|coverage|artifacts)/' },
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
