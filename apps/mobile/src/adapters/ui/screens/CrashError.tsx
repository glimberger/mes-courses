import { ErrorState } from '../components/ErrorState';
import { FullScreen } from './FullScreen';

/** Shown in place of the app when a screen failed while drawing (FR-039a); it needs no store. */
export const CrashError = ({ onRetry }: { onRetry: () => void }) => (
  <FullScreen>
    <ErrorState message="Une erreur est survenue." onRetry={onRetry} />
  </FullScreen>
);
