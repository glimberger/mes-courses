# UI Contract: Branded Startup

## Scope

This contract describes the observable startup presentation of the mobile application. It extends the
existing startup behavior without changing the navigation destination or startup error handling.

## Contract

| Condition | Required observable result |
|---|---|
| The application is opened and local composition is pending | A full-window branded splash shows the bundled `Mes Courses` visual identity. |
| Local composition resolves | The splash disappears automatically and the existing first application screen is shown. |
| The device is offline | The splash-to-application transition follows local composition and does not require a network response. |
| Local composition fails | The existing French startup error is shown and remains retryable; the splash is not stuck. |
| A newer data version is detected | The existing update-required screen is shown; the splash is not stuck. |
| The device uses light or dark appearance | The surrounding full-window surface follows the active Material 3 theme. |
| The display has safe-area insets or a different aspect ratio | The complete image remains proportionally contained and visible. |
| Assistive technology inspects the splash | The visual identity is exposed with a French accessible name such as `Mes Courses`. |

## Asset contract

- The bundled asset is `apps/mobile/assets/splash-screen.png`, derived from
  `design/splash-screen.png`.
- The asset is rendered with proportional contain behavior.
- If the asset cannot render, visible French fallback text `Mes Courses` is shown while startup
  continues under the existing lifecycle.

## Non-contracts

- The splash is not a navigation route and has no user actions.
- The splash does not initiate, await or report synchronization.
- The splash does not add persisted state or alter the existing startup error reporter.
