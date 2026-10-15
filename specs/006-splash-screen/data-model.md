# Data Model: Startup Splash Screen

This feature introduces no persisted or synchronized data entities.

## Startup presentation state

The existing `Startup` state in `apps/mobile/App.tsx` remains the source of truth:

| State | Meaning | Presentation |
|---|---|---|
| `starting` | Local composition is still preparing the application | Branded `StartupSplash` |
| `ready` | Local store and application composition are available | Existing navigation |
| `failed` | Local startup failed | Existing French startup error and retry action |
| `tooOld` | Stored data requires a newer application version | Existing update-required screen |

## Validation rules

- Only one startup state is rendered at a time.
- The splash is shown only while the existing local startup promise is pending.
- No startup state waits for remote synchronization.
- The splash asset is a bundled, immutable presentation resource; it has no user-owned fields,
  persistence, synchronization, or migration rules.
