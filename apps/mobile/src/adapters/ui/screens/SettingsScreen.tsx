import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, List, Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { DeviceInfo } from '../../../application/use-cases/list-devices';
import { BackAction } from '../components/BackAction';
import { Button } from '../components/Button';
import { ErrorState } from '../components/ErrorState';
import { formatLastSync } from '../components/format-last-sync';
import { LoadingState } from '../components/LoadingState';
import { SyncStatusBar } from '../components/SyncStatusBar';
import type { RootStackParamList } from '../routes';
import { useAppStore } from '../state/use-app-store';
import { spacing } from '../theme/spacing';
import { ChangeServerUrlDialog } from './ChangeServerUrlDialog';
import { DeviceRow } from './DeviceRow';
import { DisconnectDialog } from './DisconnectDialog';
import { PairingCodeDialog } from './PairingCodeDialog';
import { RenameDeviceDialog } from './RenameDeviceDialog';
import { RevokeDeviceDialog } from './RevokeDeviceDialog';

/** The address as people say it: without the scheme. */
const withoutScheme = (url: string) => url.replace(/^https?:\/\//, '');

/** What the Appareils section shows (contracts/ui-screens.md, Settings). */
export type DevicesState =
  | { type: 'loading' }
  | { type: 'error' }
  | { type: 'offline' }
  // Revoked or outdated: the connection state says why, and retrying cannot help.
  | { type: 'unavailable' }
  | { type: 'success'; devices: DeviceInfo[] };

type Dialog =
  | { type: 'rename'; device: DeviceInfo }
  | { type: 'revoke'; device: DeviceInfo }
  | { type: 'pairingCode' }
  | { type: 'changeUrl' }
  | { type: 'disconnect' };

/**
 * Settings (US4-1, US4-8): offers to connect a device that never was, and shows the server, the
 * devices and their management for one that is.
 */
export const SettingsScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { connection, serverUrl, lastSyncAt, status } = useAppStore(
    (state) => state.sync,
  );
  const syncNow = useAppStore((state) => state.syncNow);
  const listDevices = useAppStore((state) => state.listDevices);
  const [devices, setDevices] = useState<DevicesState>({ type: 'loading' });
  const [dialog, setDialog] = useState<Dialog | null>(null);
  // Bumped to load the list again; the effect below loads it.
  const [reload, setReload] = useState(0);

  const isConnected = connection !== 'notConnected' && serverUrl !== null;
  // Leaving the server drops its list, so a new pairing never shows the previous one.
  const [wasConnected, setWasConnected] = useState(isConnected);
  if (wasConnected !== isConnected) {
    setWasConnected(isConnected);
    if (!isConnected) setDevices({ type: 'loading' });
  }
  useEffect(() => {
    if (!isConnected) return;
    // Dropped when the screen goes or a newer load starts: only the latest is shown.
    let current = true;
    void listDevices().then((outcome) => {
      if (!current) return;
      if (outcome.ok) {
        setDevices({ type: 'success', devices: outcome.value });
      } else {
        const { type } = outcome.error;
        setDevices({
          type:
            type === 'Offline'
              ? 'offline'
              : type === 'DeviceNotAuthorized' || type === 'UpdateRequired'
                ? 'unavailable'
                : 'error',
        });
      }
    });
    return () => {
      current = false;
    };
  }, [isConnected, listDevices, reload]);
  const loadDevices = () => {
    setDevices({ type: 'loading' });
    setReload((count) => count + 1);
  };

  const closeDialog = () => {
    const closed = dialog;
    setDialog(null);
    // What a device dialog did shows in the list.
    if (closed?.type === 'rename' || closed?.type === 'revoke') {
      loadDevices();
    }
  };

  return (
    <>
      <SettingsView
        onBack={navigation.canGoBack() ? () => navigation.goBack() : null}
        onConnect={() => navigation.navigate('ConnectServer')}
        onSyncNow={() => void syncNow()}
        server={
          !isConnected
            ? null
            : {
                url: serverUrl,
                lastSyncAt,
                // A revoked or outdated app cannot sync, and a cycle already runs.
                canSyncNow: connection === 'connected' && status !== 'sending',
              }
        }
        devices={devices}
        onRetryDevices={loadDevices}
        onRenameDevice={(device) => setDialog({ type: 'rename', device })}
        onRevokeDevice={(device) => setDialog({ type: 'revoke', device })}
        onChangeUrl={() => setDialog({ type: 'changeUrl' })}
        onAddDevice={() => setDialog({ type: 'pairingCode' })}
        onDisconnect={() => setDialog({ type: 'disconnect' })}
      />
      {dialog?.type === 'rename' && (
        <RenameDeviceDialog device={dialog.device} onClose={closeDialog} />
      )}
      {dialog?.type === 'revoke' && (
        <RevokeDeviceDialog device={dialog.device} onClose={closeDialog} />
      )}
      {dialog?.type === 'pairingCode' && (
        <PairingCodeDialog onClose={closeDialog} />
      )}
      {dialog?.type === 'changeUrl' && serverUrl !== null && (
        <ChangeServerUrlDialog currentUrl={serverUrl} onClose={closeDialog} />
      )}
      {dialog?.type === 'disconnect' && (
        <DisconnectDialog onClose={closeDialog} />
      )}
    </>
  );
};

export type SettingsViewProps = {
  onBack: (() => void) | null;
  onConnect: () => void;
  /** "Synchroniser maintenant": runs a cycle at once (US3-5). */
  onSyncNow: () => void;
  /** The server this device is connected to, or null when it never was. */
  server: {
    url: string;
    lastSyncAt: string | null;
    canSyncNow: boolean;
  } | null;
  devices: DevicesState;
  onRetryDevices: () => void;
  onRenameDevice: (device: DeviceInfo) => void;
  onRevokeDevice: (device: DeviceInfo) => void;
  onChangeUrl: () => void;
  onAddDevice: () => void;
  onDisconnect: () => void;
};

/** The content of Settings, its data given as props so a story can show each state. */
export const SettingsView = ({
  onBack,
  onConnect,
  onSyncNow,
  server,
  devices,
  onRetryDevices,
  onRenameDevice,
  onRevokeDevice,
  onChangeUrl,
  onAddDevice,
  onDisconnect,
}: SettingsViewProps) => (
  <View style={styles.screen}>
    <Appbar.Header>
      {onBack && <BackAction onPress={onBack} />}
      <Appbar.Content title="Réglages" />
    </Appbar.Header>
    <SyncStatusBar />
    <ScrollView contentContainerStyle={styles.content}>
      {server === null ? (
        <>
          <Text variant="bodyLarge">
            Synchronisez vos listes avec votre serveur pour les retrouver sur
            vos autres appareils.
          </Text>
          <Button mode="contained" onPress={onConnect}>
            Connecter à un serveur
          </Button>
        </>
      ) : (
        <>
          <List.Subheader accessibilityRole="header">Serveur</List.Subheader>
          <List.Item
            title={withoutScheme(server.url)}
            description={() => (
              <Text variant="bodyMedium">
                Dernière synchronisation :{' '}
                {formatLastSync(server.lastSyncAt, new Date())}
              </Text>
            )}
          />
          <Button
            mode="outlined"
            disabled={!server.canSyncNow}
            onPress={onSyncNow}
          >
            Synchroniser maintenant
          </Button>
          <Button mode="outlined" onPress={onChangeUrl}>
            {"Modifier l'adresse"}
          </Button>

          <List.Subheader accessibilityRole="header">Appareils</List.Subheader>
          <DevicesSection
            devices={devices}
            onRetry={onRetryDevices}
            onRename={onRenameDevice}
            onRevoke={onRevokeDevice}
          />

          <List.Subheader accessibilityRole="header">Actions</List.Subheader>
          <Button mode="outlined" onPress={onAddDevice}>
            Ajouter un appareil
          </Button>
          <Button mode="outlined" onPress={onDisconnect}>
            Déconnecter cet appareil
          </Button>
        </>
      )}
    </ScrollView>
  </View>
);

const DevicesSection = ({
  devices,
  onRetry,
  onRename,
  onRevoke,
}: {
  devices: DevicesState;
  onRetry: () => void;
  onRename: (device: DeviceInfo) => void;
  onRevoke: (device: DeviceInfo) => void;
}) => {
  switch (devices.type) {
    case 'loading':
      return <LoadingState />;
    case 'error':
      return (
        <ErrorState
          message="Impossible de charger les appareils."
          onRetry={onRetry}
        />
      );
    case 'offline':
      // Being offline is normal: no error color.
      return (
        <Text variant="bodyMedium" style={styles.offline}>
          Liste des appareils indisponible hors connexion.
        </Text>
      );
    case 'unavailable':
      return (
        <Text variant="bodyMedium" style={styles.offline}>
          Liste des appareils indisponible pour le moment.
        </Text>
      );
    case 'success':
      return (
        <>
          {devices.devices.map((device) => (
            <DeviceRow
              key={device.id}
              device={device}
              onRename={() => onRename(device)}
              onRevoke={() => onRevoke(device)}
            />
          ))}
        </>
      );
  }
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md },
  offline: { paddingHorizontal: spacing.md },
});
