/**
 * Architecture rules (research R15). Run from the root with `pnpm run test:architecture`.
 * Paths are relative to the repository root.
 */

// Workspace packages that are pure (no framework, no side effects, importing only other pure
// packages). Domain and application code may import them. 003 adds `packages/sync-core`.
const PURE_PACKAGES = ['sync-core'];

const pure =
  PURE_PACKAGES.length > 0 ? `|^packages/(${PURE_PACKAGES.join('|')})/` : '';

const MOBILE_SRC = '^apps/mobile/src';

const SERVER_SRC = '^apps/server/src';
const SYNC_CORE = '^packages/sync-core/';
const DELIVERY_SRC = '^apps/delivery/src';

const STORIES = '\\.stories\\.tsx$';
const STORYBOOK_CONFIG = '^apps/mobile/\\.rnstorybook/';
const TESTING_FOLDERS = `${MOBILE_SRC}/(adapters/ui|application)/testing/|^apps/mobile/test/`;
const STORYBOOK_IMPORTERS = `${STORIES}|${STORYBOOK_CONFIG}|^apps/mobile/metro\\.config\\.js$|^apps/mobile/src/adapters/ui/stories\\.test\\.tsx$`;
const TESTING_FILES = `${STORIES}|${TESTING_FOLDERS}`;
const TESTING_IMPORTERS = `\\.test\\.tsx?$|${STORIES}|${STORYBOOK_CONFIG}|${TESTING_FOLDERS}|^tests/sync/src/testing/`;

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
      name: 'mail-libraries-only-in-the-mail-adapter',
      severity: 'error',
      comment:
        'nodemailer and smtp-server are imported only under apps/server/src/adapters/mail/ and its tests (004 plan).',
      from: { pathNot: `${SERVER_SRC}/adapters/mail/` },
      to: { path: '(^|node_modules/)(nodemailer|smtp-server)(/|$)' },
    },
    {
      name: 'server-domain-application-never-import-the-mail-adapter',
      severity: 'error',
      comment:
        'The server domain and application layers reach mail through the Mailer port, never through adapters/mail.',
      from: { path: `${SERVER_SRC}/(domain|application)/` },
      to: { path: `${SERVER_SRC}/adapters/mail/` },
    },
    {
      name: 'password-code-only-in-the-crypto-adapter',
      severity: 'error',
      comment:
        'node:crypto (password hashing, tokens) is imported by the crypto adapter only; the sqlite migrations keep their existing randomUUID use.',
      from: {
        path: `${SERVER_SRC}/`,
        pathNot: `${SERVER_SRC}/adapters/(crypto|sqlite)/`,
      },
      to: { path: '^(node:)?crypto$', dependencyTypes: ['core'] },
    },
    {
      name: 'delivery-domain-imports-only-itself',
      severity: 'error',
      comment:
        'The delivery domain imports only itself: no npm package and no Node module.',
      from: { path: `${DELIVERY_SRC}/domain/` },
      to: { pathNot: `${DELIVERY_SRC}/domain/` },
    },
    {
      name: 'delivery-application-imports-only-domain-and-application',
      severity: 'error',
      comment:
        'The delivery application layer imports the delivery domain and itself only.',
      from: { path: `${DELIVERY_SRC}/application/` },
      to: { pathNot: `${DELIVERY_SRC}/(domain|application)/` },
    },
    {
      name: 'delivery-adapters-imported-only-by-composition-and-adapters',
      severity: 'error',
      comment:
        'Only delivery adapters and the delivery composition root import delivery adapters.',
      from: { pathNot: `${DELIVERY_SRC}/(adapters|composition)/` },
      to: { path: `${DELIVERY_SRC}/adapters/` },
    },
    {
      name: 'delivery-adapters-never-import-composition',
      severity: 'error',
      comment: 'Delivery adapters never import the composition root.',
      from: { path: `${DELIVERY_SRC}/adapters/` },
      to: { path: `${DELIVERY_SRC}/composition/` },
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
      name: 'sync-core-imports-nothing-outside-itself',
      severity: 'error',
      comment:
        'packages/sync-core is pure: it imports nothing outside itself, no npm package and no Node built-in (research R16).',
      from: { path: SYNC_CORE },
      to: { pathNot: SYNC_CORE },
    },
    {
      name: 'server-domain-imports-only-domain-and-sync-core',
      severity: 'error',
      comment:
        'The server domain imports only itself and @mes-courses/sync-core (research R16).',
      from: { path: `${SERVER_SRC}/domain/` },
      to: { pathNot: `${SERVER_SRC}/domain/|${SYNC_CORE}` },
    },
    {
      name: 'server-application-imports-only-domain-application-and-sync-core',
      severity: 'error',
      comment:
        'The server application layer imports the server domain, itself and @mes-courses/sync-core only (research R16).',
      from: { path: `${SERVER_SRC}/application/` },
      to: { pathNot: `${SERVER_SRC}/(domain|application)/|${SYNC_CORE}` },
    },
    {
      name: 'server-adapters-imported-only-by-composition-and-adapters',
      severity: 'error',
      comment:
        'Only server adapters, the server composition root and the server `./testing` entry import server adapters.',
      from: { pathNot: `${SERVER_SRC}/(adapters|composition|testing)/` },
      to: { path: `${SERVER_SRC}/adapters/` },
    },
    {
      name: 'no-server-adapter-imports-another-adapter',
      severity: 'error',
      comment: 'Server adapters never import each other, not even types.',
      from: { path: `${SERVER_SRC}/adapters/([^/]+)/` },
      to: {
        path: `${SERVER_SRC}/adapters/`,
        pathNot: `${SERVER_SRC}/adapters/$1/`,
      },
    },
    {
      name: 'testing-entries-imported-only-by-tests',
      severity: 'error',
      comment:
        'The ./testing entries of the app and the server are imported only by tests/** (Principle XI).',
      from: { pathNot: '^tests/' },
      to: {
        path: `^apps/mobile/test/index\\.ts$|${SERVER_SRC}/testing/index\\.ts$`,
      },
    },
    {
      name: 'nothing-imports-tests',
      severity: 'error',
      comment: 'Nothing imports tests/**.',
      from: { pathNot: '^tests/' },
      to: { path: '^tests/' },
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
