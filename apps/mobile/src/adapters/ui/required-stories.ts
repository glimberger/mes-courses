/**
 * Ids (`<title>/<export name>`) of the stories every screen state must have, from
 * specs/001-shopping-lists/contracts/ui-validation.md#required-stories. Each story phase
 * adds its ids here; stories.test.tsx fails for an id that no story has.
 */
export const requiredStories: readonly string[] = [
  'Components/LoadingState/Default',
  'Components/EmptyState/WithAction',
  'Components/EmptyState/WithoutAction',
  'Components/ErrorState/Default',
  'Screens/Startup/Error',
  'Screens/Startup/UpdateRequired',
  'Screens/Crash/Error',
];
