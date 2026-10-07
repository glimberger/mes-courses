import { EmptyState } from '../components/EmptyState';
import { FullScreen } from './FullScreen';

/**
 * Shown in place of the app when its data comes from a newer version (FR-040). It offers no
 * action: only an update helps. It needs no store.
 */
export const UpdateRequired = () => (
  <FullScreen>
    <EmptyState message="Cette version de l'application est trop ancienne pour vos données. Mettez-la à jour." />
  </FullScreen>
);
