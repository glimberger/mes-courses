import { SettingsRow } from '../components/SettingsRow';
import { useAppInfo } from '../app-info-context';

/**
 * The bottom row of Settings: "Version X.Y.Z (build N)" and the environment. Pressing it opens
 * Nouveautés, when `onPress` is given.
 */
export const VersionRow = ({
  onPress,
}: {
  onPress?: (() => void) | undefined;
}) => {
  const { version, build, environment } = useAppInfo();
  return (
    <SettingsRow
      icon="info"
      onPress={onPress}
      chevron={onPress !== undefined}
      title={
        build === null
          ? `Version ${version}`
          : `Version ${version} (build ${build})`
      }
      subtitle={
        environment === null ? undefined : `Environnement : ${environment}`
      }
    />
  );
};
