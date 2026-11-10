import { SettingsRow } from '../components/SettingsRow';
import { useAppInfo } from '../app-info-context';

/** The bottom row of Settings: "Version X.Y.Z (build N)" and the environment, as plain text. */
export const VersionRow = () => {
  const { version, build, environment } = useAppInfo();
  return (
    <SettingsRow
      icon="info"
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
