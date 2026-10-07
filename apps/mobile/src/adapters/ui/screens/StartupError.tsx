import { ErrorState } from '../components/ErrorState';
import { FullScreen } from './FullScreen';

/** Shown in place of the app when it could not start (FR-039); it needs no store. */
export const StartupError = ({ onRetry }: { onRetry: () => void }) => (
  <FullScreen>
    <ErrorState
      message="L'application n'a pas pu démarrer."
      onRetry={onRetry}
    />
  </FullScreen>
);
