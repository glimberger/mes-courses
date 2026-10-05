# Mes Courses Constitution

## Core Principles

### I. Test-First Development (NON-NEGOTIABLE)

The project follows strict Test-Driven Development. Every change to production code follows
the Red-Green-Refactor cycle:

- **Red**: write one failing test that expresses the next expected behavior. Run it and
  confirm it fails for the expected reason before writing any production code.
- **Green**: write the minimum production code needed to make that test pass. No code is
  written that no failing test requires.
- **Refactor**: improve the structure of both production and test code while all tests stay
  green. Behavior does not change during refactoring.

Production code without a test that drove it MUST NOT be merged. Bug fixes start with a test
that reproduces the bug. Tests MUST NOT be deleted, skipped or weakened to make a change pass;
a test is only changed when the expected behavior itself changes.

Rationale: tests written first define the behavior before the implementation biases it, keep
the design testable, and give a safety net that makes every later refactoring cheap.

### II. Tests as Executable Specification

Tests describe observable behavior, not implementation details. Each acceptance scenario in a
feature spec MUST map to at least one automated test. Test names state the behavior in domain
language (for example "adding an item already in the list increases its quantity"). Tests
exercise public interfaces; they MUST NOT depend on private internals that a refactoring could
change without altering behavior.

Rationale: behavior-focused tests survive refactoring and keep specs, tests and code aligned.

### III. Fast, Deterministic, Isolated Tests

The full unit test suite MUST run locally in seconds and give the same result on every run.
Tests MUST NOT depend on execution order, wall-clock time, randomness, network access or shared
mutable state; such dependencies are injected and replaced with controlled test doubles.
A flaky test is treated as a failing test and fixed before any other work proceeds.

Rationale: strict TDD runs the tests after every small step; a slow or flaky suite breaks the
cycle and erodes trust in the results.

### IV. Simplicity (YAGNI)

Build only what a current, specified behavior requires. No speculative abstractions,
configuration options or dependencies. A new third-party dependency MUST be justified in the
feature plan. Duplication is removed during the Refactor step once it is real, not anticipated.
Ports required by Principle VI are not speculative abstractions; abstractions inside a layer
follow this principle.

Rationale: in TDD the design emerges from tests; anticipating needs adds untested code paths.

### V. Single Design System

The whole user interface is built with one design system: Material 3, themed with the export in
`design/material-theme.json`.

- Screens are composed only of Material 3 components from the library chosen in the plan, or of
  project components built from them and kept in one shared UI component module. A screen MUST
  NOT define its own one-off visual component or style, and no second UI library is added.
- Colors, typography, shapes, spacing and elevation reference design system tokens; hard-coded
  values are forbidden. `design/material-theme.json` is the single source of truth for colors
  (light and dark schemes, including contrast variants), and both schemes MUST be supported.
- A need the design system does not cover is met by adding a component to the shared module,
  reviewed in its pull request, never by styling a screen ad hoc.

Rationale: one design system keeps the interface coherent, and one token source makes a theme
change a single edit.

### VI. Hexagonal Architecture

The application follows a hexagonal architecture (ports and adapters), with three layers:

- **Domain**: entities, value objects and business rules. It has no dependency on any
  framework, library with side effects, user interface, storage or network code.
- **Application**: use cases that orchestrate the domain. They declare the ports they need:
  driving ports (the operations the application offers) and driven ports (interfaces for
  what it requires from the outside, such as persistence or the clock).
- **Adapters**: implementations of ports for a given technology (user interface, storage,
  external services). Adapters depend on the application; nothing depends on adapters.

Dependencies point inward only: adapters → application → domain. A source file in the domain
or application layer MUST NOT import from an adapter or a framework; an automated architecture
test enforces this rule once the stack is chosen. Domain and use-case tests run against
in-memory test doubles of the driven ports; each adapter has its own tests against the real
technology.

Rationale: keeping business rules free of technology makes them fast to test first
(Principles I and III) and lets the storage or user interface change without touching them.

### VII. Offline First

The application is offline first: it MUST be fully usable without a network connection.

- **Local source of truth**: user data is stored on the device, and every read and write goes
  to local storage first. A user action completes and its result is shown without waiting for
  the network.
- **Network off the critical path**: no feature may block, fail or lose data because the
  network is missing, slow or drops mid-operation. Network access only enriches or shares data
  that the application can already use locally.
- **Synchronization as an adapter**: when a feature needs remote data or sharing, it goes
  through a driven port (Principle VI). Changes made offline are kept and sent when
  connectivity returns; the feature spec defines how concurrent changes are reconciled, and
  that rule is deterministic and tested in the domain or application layer.
- **Offline is tested**: each feature has tests that run with no network available, and any
  synchronization has tests for connectivity loss and recovery, using test doubles of the
  driven ports (Principle III).

Rationale: shopping happens in stores where the connection is often poor; a list that cannot
be read or ticked off there fails its core purpose.

### VIII. Observability and Error Tracking

The application reports its errors to an error tracking tool, so that failures in users' hands
are seen and fixed rather than discovered by chance.

- **No silent failure**: every unexpected error (uncaught exception, unhandled rejection,
  failed adapter operation) is captured and reported. An error caught in code is either
  recovered from with an outcome the user can see, or reported; it MUST NOT be swallowed.
- **Actionable reports**: each report carries the stack trace, readable for the deployed build
  (symbolicated), the application version, the platform and the environment.
- **Behind a port**: error reporting is a driven port (Principle VI). Domain and application
  code MUST NOT import the tool's SDK. Tests assert what is reported through an in-memory
  test double, and no test or local development run sends data to the real service.
- **Offline-safe**: reports raised offline are kept in a bounded local queue and sent when
  connectivity returns (Principle VII). Reporting never blocks the user, and a failure of the
  tracking tool never breaks the application.
- **Privacy**: reports MUST NOT contain the content of the user's lists or any personal data.
  Any user identifier is pseudonymous.

Rationale: an offline application runs far from any server log; without error tracking, its
failures stay invisible to the maintainer.

### IX. Explicit Screen States

Every screen, or screen region, that displays data implements each of its states explicitly,
and each state is rendered by its dedicated component from the shared UI module (Principle V):

- **Loading**: data is not available yet; a loading component is shown, never a blank screen or
  stale content presented as current.
- **Empty**: there is no data; the empty component says so and offers the next useful action
  (for example, adding a first item).
- **Error**: data could not be obtained; the error component says what failed in plain words and
  offers a recovery action when one exists. The error is reported (Principle VIII).
- **Success**: the data is shown.
- **Synchronization**: when the screen shows data that is synchronized (Principle VII), a
  synchronization status component shows whether local changes are pending, in progress, done
  or failed. Being offline is a normal status, not an error.

The UI adapter models a screen's state as one explicit type in which these states are mutually
exclusive, so a screen cannot render an undefined combination. Each state has at least one
automated test, and the feature spec's acceptance scenarios cover every state of each screen.

Rationale: loading, empty and failure are the moments users judge an application by; handling
them through shared components keeps them consistent and impossible to forget.

### X. French Interface, No Internationalization

The application targets French-speaking users only, and its interface is written in French.

- All user-facing text is in French: labels, messages, the texts of every screen state
  (Principle IX), notifications and accessibility labels. Numbers, quantities and dates follow
  French conventions (for example a decimal comma).
- There is no internationalization system: no translation library, message catalog,
  translation keys or language switch. Text is written directly where the UI adapter uses it.
- User-facing text exists only in the user interface adapter (Principle VI). Domain and
  application code never produce display text; they return typed results and errors that the
  adapter turns into French messages.
- Tests assert the French text as the user reads it (Principle II).

Rationale: a single audience needs a single language; an internationalization layer would be
untested speculative infrastructure (Principle IV). Keeping text out of the domain keeps a
later change of language confined to one adapter.

## Quality Gates

Before any commit:

- The whole test suite is green; no test is skipped or disabled without a linked, documented reason.
- The project's linter and formatter run clean.
- New or changed behavior is covered by tests written before the code (Principle I).
- New or changed behavior works with no network available (Principle VII).

Before merging a pull request:

- Every gate above passes in continuous integration (CI).
- The commit history or PR description shows the test-first progression for each behavior
  (failing test, then implementation, then refactoring).

Continuous integration is blocking for every pull request:

- CI runs on every pull request and on every push to the default branch. It runs at least the
  full test suite (including the architecture test of Principle VI and the offline tests of
  Principle VII), the linter, a formatter check and the build.
- The default branch is protected: its CI jobs are required status checks, and a pull request
  MUST NOT be merged while any of them is failing, pending or skipped. No one bypasses this
  protection, administrators included.
- A red CI is fixed in the pull request itself, never by disabling, skipping or weakening a
  check. Changing the set of required checks is itself a reviewed pull request.
- CI and branch protection are in place before the first application code is merged: the
  first feature plan includes them.

## Development Workflow

- Features go through Spec Kit: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` →
  `/speckit-implement`. Generated task lists MUST order each test task before the
  implementation task it drives.
- Each feature spec states the feature's behavior while offline and, when it shares data,
  how offline changes are synchronized and reconciled (Principle VII).
- Work happens in small increments: one behavior per Red-Green-Refactor cycle, committed often.
- Branching, commit message format (Conventional Commits), secret scanning and README rules
  follow the workspace `AGENTS.md`.
- Code, comments, commits and documentation are written in English; only user-facing
  interface text is in French (Principle X).

## Governance

This constitution supersedes other project practices. Where it conflicts with the workspace
`AGENTS.md`, this constitution wins for this project.

- **Amendments**: proposed through `/speckit-constitution`, reviewed in a pull request, and
  merged only with the maintainer's approval. An amendment that changes how existing code must
  be written includes a migration note.
- **Versioning**: semantic versioning. MAJOR for removing or redefining a principle, MINOR for
  adding a principle or section or materially expanding guidance, PATCH for wording fixes.
- **Compliance**: every plan clears the Constitution Check in `/speckit-plan`, and every pull
  request review verifies the Quality Gates. Any deviation MUST be justified in the plan's
  Complexity Tracking section; a deviation from Principle I is never accepted.

**Version**: 1.6.0 | **Ratified**: 2026-10-05 | **Last Amended**: 2026-10-05
