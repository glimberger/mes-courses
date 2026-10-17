import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, List, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { DeviceInfo } from '../../../application/use-cases/list-devices';
import { BackAction } from '../components/BackAction';
import { Button } from '../components/Button';
import { ErrorState } from '../components/ErrorState';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsRow } from '../components/SettingsRow';
import { formatLastSync } from '../components/format-last-sync';
import { LoadingState } from '../components/LoadingState';
import { SyncStatusBar } from '../components/SyncStatusBar';
import type { RootStackParamList } from '../routes';
import { useAppStore } from '../state/use-app-store';
import { spacing } from '../theme/spacing';
import type { AppTheme } from '../theme/theme';
import { ChangePasswordDialog } from './ChangePasswordDialog';
import { DeleteMyAccountDialog } from './DeleteMyAccountDialog';
import { DeviceRow } from './DeviceRow';
import { RenameDeviceDialog } from './RenameDeviceDialog';
import { RevokeDeviceDialog } from './RevokeDeviceDialog';
import { SignOutDialog } from './SignOutDialog';

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

/** What the Compte section shows (contracts/ui-screens.md, Settings). */
export type AccountState =
  | { type: 'loading' }
  | { type: 'error' }
  | { type: 'offline' }
  // Revoked or outdated: the connection state says why, and retrying cannot help.
  | { type: 'unavailable' }
  | { type: 'success'; email: string; administrator: boolean };

type Dialog =
  | { type: 'rename'; device: DeviceInfo }
  | { type: 'revoke'; device: DeviceInfo }
  | { type: 'changePassword' }
  | { type: 'signOut' }
  | { type: 'deleteAccount' };

/** Said when an action that needs the server is chosen offline (contracts/ui-screens.md). */
const CONNECTION_NEEDED = 'Connexion au serveur nécessaire.';

/**
 * Settings (US4-1, US4-8, US6-1 to US6-7): offers to sign in on a device that never was, and
 * shows the account, the server, the devices and their management for one that is.
 */
export const SettingsScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { connection, serverUrl, lastSyncAt, status } = useAppStore(
    (state) => state.sync,
  );
  const syncNow = useAppStore((state) => state.syncNow);
  const listDevices = useAppStore((state) => state.listDevices);
  const getAccountSettings = useAppStore((state) => state.getAccountSettings);
  const [devices, setDevices] = useState<DevicesState>({ type: 'loading' });
  const [account, setAccount] = useState<AccountState>({ type: 'loading' });
  const [dialog, setDialog] = useState<Dialog | null>(null);
  // An action needing the server was chosen while the account could not be read.
  const [connectionNeeded, setConnectionNeeded] = useState(false);
  // Bumped to load the list again; the effect below loads it.
  const [reload, setReload] = useState(0);

  const isConnected = connection !== 'notConnected' && serverUrl !== null;
  // Leaving the server drops its list, so a new pairing never shows the previous one.
  const [wasConnected, setWasConnected] = useState(isConnected);
  if (wasConnected !== isConnected) {
    setWasConnected(isConnected);
    if (!isConnected) {
      setDevices({ type: 'loading' });
      setAccount({ type: 'loading' });
    }
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
  // The address and the role are the server's to tell on every opening, never read from storage.
  useEffect(() => {
    if (!isConnected) return;
    let current = true;
    void getAccountSettings().then(({ account: outcome }) => {
      if (!current || outcome === null) return;
      if (outcome.ok) {
        setAccount({
          type: 'success',
          email: outcome.value.email,
          administrator: outcome.value.role === 'administrator',
        });
      } else {
        const { type } = outcome.error;
        setAccount({
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
  }, [isConnected, getAccountSettings, reload]);
  const loadDevices = () => {
    setConnectionNeeded(false);
    setDevices({ type: 'loading' });
    setAccount({ type: 'loading' });
    setReload((count) => count + 1);
  };

  /** Opens a dialog that needs the server, or says so when the account is out of reach. */
  const openOnline = (opened: Dialog) => {
    if (account.type === 'offline') {
      setConnectionNeeded(true);
      return;
    }
    setConnectionNeeded(false);
    setDialog(opened);
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
        onConnect={() => navigation.navigate('SignIn')}
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
        account={account}
        onManageAccounts={() => navigation.navigate('Accounts')}
        devices={devices}
        onRetryDevices={loadDevices}
        onRenameDevice={(device) => setDialog({ type: 'rename', device })}
        onRevokeDevice={(device) => setDialog({ type: 'revoke', device })}
        onChangePassword={() => openOnline({ type: 'changePassword' })}
        onSignOut={() => setDialog({ type: 'signOut' })}
        onDeleteAccount={() => openOnline({ type: 'deleteAccount' })}
        connectionNeeded={connectionNeeded}
      />
      {dialog?.type === 'rename' && (
        <RenameDeviceDialog device={dialog.device} onClose={closeDialog} />
      )}
      {dialog?.type === 'revoke' && (
        <RevokeDeviceDialog device={dialog.device} onClose={closeDialog} />
      )}
      {dialog?.type === 'changePassword' && (
        <ChangePasswordDialog onClose={closeDialog} />
      )}
      {dialog?.type === 'signOut' && (
        <SignOutDialog
          onClose={closeDialog}
          onSignedOut={() => navigation.navigate('SignIn')}
        />
      )}
      {dialog?.type === 'deleteAccount' && (
        <DeleteMyAccountDialog
          onClose={closeDialog}
          onDeleted={() => navigation.navigate('SignIn')}
        />
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
  account: AccountState;
  /** "Gérer les comptes" (administrators only). */
  onManageAccounts: () => void;
  devices: DevicesState;
  onRetryDevices: () => void;
  onRenameDevice: (device: DeviceInfo) => void;
  onRevokeDevice: (device: DeviceInfo) => void;
  onChangePassword: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
  /** "Connexion au serveur nécessaire." under the actions (offline). */
  connectionNeeded: boolean;
};

/** The content of Settings, its data given as props so a story can show each state. */
export const SettingsView = ({
  onBack,
  onConnect,
  onSyncNow,
  server,
  account,
  onManageAccounts,
  devices,
  onRetryDevices,
  onRenameDevice,
  onRevokeDevice,
  onChangePassword,
  onSignOut,
  onDeleteAccount,
  connectionNeeded,
}: SettingsViewProps) => {
  const colors = (useTheme() as { colors: AppTheme['colors'] }).colors;
  return (
    <View style={styles.screen}>
      <Appbar.Header>
        {onBack && <BackAction onPress={onBack} />}
        <Appbar.Content title="Réglages" />
      </Appbar.Header>
      <SyncStatusBar />
      <ScrollView contentContainerStyle={styles.content}>
        {server === null ? (
          <SettingsCard>
            <Text variant="bodyLarge">
              Connectez-vous pour retrouver vos listes sur vos autres appareils.
            </Text>
            <Button
              mode="contained-tonal"
              buttonColor={colors.primaryContainer}
              textColor={colors.onPrimaryContainer}
              onPress={onConnect}
            >
              Se connecter
            </Button>
          </SettingsCard>
        ) : (
          <>
            <List.Subheader accessibilityRole="header">Compte</List.Subheader>
            <SettingsCard>
              <AccountSection
                account={account}
                onRetry={onRetryDevices}
                onManageAccounts={onManageAccounts}
                onChangePassword={onChangePassword}
              />
            </SettingsCard>

            <List.Subheader accessibilityRole="header">Serveur</List.Subheader>
            <SettingsCard>
              <SettingsRow
                icon="dns"
                title={withoutScheme(server.url)}
                subtitle={`Dernière synchronisation : ${formatLastSync(
                  server.lastSyncAt,
                  new Date(),
                )}`}
              />
              <Button
                mode="outlined"
                disabled={!server.canSyncNow}
                onPress={onSyncNow}
              >
                Synchroniser maintenant
              </Button>
            </SettingsCard>

            <List.Subheader accessibilityRole="header">
              Appareils
            </List.Subheader>
            <SettingsCard>
              <DevicesSection
                devices={devices}
                onRetry={onRetryDevices}
                onRename={onRenameDevice}
                onRevoke={onRevokeDevice}
              />
            </SettingsCard>

            <List.Subheader accessibilityRole="header">Actions</List.Subheader>
            <SettingsCard>
              <Button mode="outlined" onPress={onSignOut}>
                Se déconnecter de cet appareil
              </Button>
              <Button mode="outlined" onPress={onDeleteAccount}>
                Supprimer mon compte
              </Button>
              {connectionNeeded && (
                <Text variant="bodyMedium" style={styles.offline}>
                  {CONNECTION_NEEDED}
                </Text>
              )}
            </SettingsCard>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const AccountSection = ({
  account,
  onRetry,
  onManageAccounts,
  onChangePassword,
}: {
  account: AccountState;
  onRetry: () => void;
  onManageAccounts: () => void;
  onChangePassword: () => void;
}) => {
  switch (account.type) {
    case 'loading':
      return <LoadingState />;
    case 'error':
      return (
        <ErrorState
          message="Impossible de charger le compte."
          onRetry={onRetry}
        />
      );
    case 'offline':
      // Being offline is normal: no error color.
      return (
        <>
          <Text variant="bodyMedium" style={styles.offline}>
            Compte indisponible hors connexion.
          </Text>
          <Button mode="outlined" onPress={onChangePassword}>
            Changer de mot de passe
          </Button>
        </>
      );
    case 'unavailable':
      return (
        <Text variant="bodyMedium" style={styles.offline}>
          Compte indisponible pour le moment.
        </Text>
      );
    case 'success':
      return (
        <>
          <SettingsRow
            icon="account_circle"
            title={account.email}
            subtitle={account.administrator ? 'Administrateur' : undefined}
          />
          <Button mode="outlined" onPress={onChangePassword}>
            Changer de mot de passe
          </Button>
          {account.administrator && (
            <Button mode="outlined" onPress={onManageAccounts}>
              Gérer les comptes
            </Button>
          )}
        </>
      );
  }
};

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
