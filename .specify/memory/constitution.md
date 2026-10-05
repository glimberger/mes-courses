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

### V. Consistent Design System

The user interface uses the Material 3 theme exported in `design/material-theme.json` as the
single source of truth for colors (light and dark schemes, including contrast variants).
Components MUST reference theme tokens instead of hard-coded color values. Both light and dark
schemes MUST be supported.

Rationale: one token source keeps the interface coherent and makes theme changes a single edit.

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

## Quality Gates

Before any commit:

- The whole test suite is green; no test is skipped or disabled without a linked, documented reason.
- The project's linter and formatter run clean.
- New or changed behavior is covered by tests written before the code (Principle I).

Before merging a pull request:

- The gates above pass in continuous integration once it exists.
- The commit history or PR description shows the test-first progression for each behavior
  (failing test, then implementation, then refactoring).

## Development Workflow

- Features go through Spec Kit: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` →
  `/speckit-implement`. Generated task lists MUST order each test task before the
  implementation task it drives.
- Work happens in small increments: one behavior per Red-Green-Refactor cycle, committed often.
- Branching, commit message format (Conventional Commits), secret scanning and README rules
  follow the workspace `AGENTS.md`.
- Code, comments, commits and documentation are written in English.

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

**Version**: 1.1.0 | **Ratified**: 2026-10-05 | **Last Amended**: 2026-10-05
