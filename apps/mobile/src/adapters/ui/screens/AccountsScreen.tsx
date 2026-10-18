import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Menu, Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { AccountSummary } from '@mes-courses/sync-core';

import { AppbarIconAction } from '../components/AppbarIconAction';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { formatLastSync } from '../components/format-last-sync';
import { LoadingState } from '../components/LoadingState';
import { ScreenHeader } from '../components/ScreenHeader';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsRow } from '../components/SettingsRow';
import { StateLayout } from '../components/StateLayout';
import { SyncStatusBar } from '../components/SyncStatusBar';
import { useAppStore } from '../state/use-app-store';
import { spacing } from '../theme/spacing';
import {
  DeleteAccountDialog,
  ResendCredentialsDialog,
  SuspendAccountDialog,
} from './AccountActionDialogs';
import { InviteAccountDialog } from './InviteAccountDialog';

/** What the list shows (contracts/ui-screens.md, Accounts). */
export type AccountsState =
  | { type: 'loading' }
  | { type: 'error' }
  | { type: 'offline' }
  // Only the administrator exists.
  | { type: 'empty' }
  | { type: 'success'; accounts: AccountSummary[] };

/** The chip of an account: its state in words. */
export const stateLabel = (account: AccountSummary): string => {
  switch (account.state) {
    case 'active':
      return 'Actif';
    case 'invited':
      return account.invitationExpired
        ? 'Invitation expirée'
        : 'Invité, pas encore connecté';
    case 'suspended':
      return 'Suspendu';
  }
};

/**
 * The accounts of the server, for an administrator (US5-1): the address, the state and the last
 * synchronization of each, and nothing else of the account (research R12).
 */
export const AccountsScreen = () => {
  const navigation = useNavigation();
  const listAccounts = useAppStore((state) => state.listAccounts);
  const [state, setState] = useState<AccountsState>({ type: 'loading' });
  const [inviting, setInviting] = useState(false);
  const [action, setAction] = useState<RowAction | null>(null);
  const reactivate = useAppStore((state) => state.reactivateAccount);
  // Bumped to load the list again; the effect below loads it.
  const [reload, setReload] = useState(0);

  useEffect(() => {
    // Dropped when the screen goes or a newer load starts: only the latest is shown.
    let current = true;
    void listAccounts().then((outcome) => {
      if (!current) return;
      if (outcome.ok) {
        setState(
          outcome.value.length <= 1
            ? { type: 'empty' }
            : { type: 'success', accounts: outcome.value },
        );
      } else {
        setState({
          type: outcome.error.type === 'Offline' ? 'offline' : 'error',
        });
      }
    });
    return () => {
      current = false;
    };
  }, [listAccounts, reload]);

  const load = useCallback(() => {
    setState({ type: 'loading' });
    setReload((count) => count + 1);
  }, []);

  const closeInvite = (invited: boolean) => {
    setInviting(false);
    if (invited) load();
  };

  const closeAction = (done: boolean) => {
    setAction(null);
    if (done) load();
  };

  const choose = (choice: RowAction) => {
    if (choice.type !== 'reactivate') return setAction(choice);
    // No confirmation: lifting a suspension loses nothing. The snackbar says it was done.
    void reactivate(choice.account.id).then((outcome) => {
      if (outcome.ok || outcome.error.type === 'NotFound') load();
    });
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        variant="center"
        title="Comptes"
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        actions={
          <AppbarIconAction
            icon="person_add"
            accessibilityLabel="Inviter"
            onPress={() => setInviting(true)}
          />
        }
      />
      <SyncStatusBar />
      <AccountsView
        state={state}
        onRetry={load}
        onInvite={() => setInviting(true)}
        onAction={choose}
      />
      {inviting && <InviteAccountDialog onClose={closeInvite} />}
      {action?.type === 'suspend' && (
        <SuspendAccountDialog account={action.account} onClose={closeAction} />
      )}
      {action?.type === 'resend' && (
        <ResendCredentialsDialog
          account={action.account}
          onClose={closeAction}
        />
      )}
      {action?.type === 'delete' && (
        <DeleteAccountDialog account={action.account} onClose={closeAction} />
      )}
    </View>
  );
};

/** What the row menu of an account asks for. */
export type RowAction = {
  type: 'suspend' | 'reactivate' | 'resend' | 'delete';
  account: AccountSummary;
};

export type AccountsViewProps = {
  state: AccountsState;
  onRetry: () => void;
  onInvite: () => void;
  /** Optional so a story can show the list alone. */
  onAction?: (action: RowAction) => void;
};

/** The content of Accounts, its state given as a prop so a story can show each one. */
export const AccountsView = ({
  state,
  onRetry,
  onInvite,
  onAction,
}: AccountsViewProps) => {
  switch (state.type) {
    case 'loading':
      return <LoadingState />;
    case 'error':
      return (
        <ErrorState
          message="Impossible de charger les comptes."
          onRetry={onRetry}
        />
      );
    case 'offline':
      // Being offline is normal: no error color.
      return (
        <StateLayout>
          <Text variant="bodyMedium">
            Liste des comptes indisponible hors connexion.
          </Text>
        </StateLayout>
      );
    case 'empty':
      return (
        <EmptyState
          message="Vous êtes le seul utilisateur."
          action={{ label: "Inviter quelqu'un", onPress: onInvite }}
        />
      );
    case 'success':
      return (
        <FlatList
          data={state.accounts}
          keyExtractor={(account) => account.id}
          renderItem={({ item }) => (
            <AccountRow account={item} onAction={onAction} />
          )}
          contentContainerStyle={styles.list}
        />
      );
  }
};

const AccountRow = ({
  account,
  onAction,
}: {
  account: AccountSummary;
  onAction: ((action: RowAction) => void) | undefined;
}) => {
  const [open, setOpen] = useState(false);
  const choose = (type: RowAction['type']) => () => {
    setOpen(false);
    onAction?.({ type, account });
  };
  return (
    <SettingsCard>
      <SettingsRow
        icon="account_circle"
        title={account.email}
        titleNumberOfLines={1}
        subtitle={`Dernière synchronisation : ${formatLastSync(account.lastSyncAt, new Date())}`}
        // The chip goes under the text: a wide one would squeeze the email to a few characters.
        footer={<Chip tone="secondary">{stateLabel(account)}</Chip>}
        trailing={
          onAction !== undefined && (
            <Menu
              visible={open}
              onDismiss={() => setOpen(false)}
              overlayAccessibilityLabel="Fermer le menu"
              anchor={
                <AppbarIconAction
                  icon="more_vert"
                  accessibilityLabel={`Actions de ${account.email}`}
                  onPress={() => setOpen(true)}
                />
              }
            >
              {account.state === 'suspended' ? (
                <Menu.Item title="Réactiver" onPress={choose('reactivate')} />
              ) : (
                <Menu.Item title="Suspendre" onPress={choose('suspend')} />
              )}
              {account.state === 'invited' && (
                <Menu.Item
                  title="Renvoyer les identifiants"
                  onPress={choose('resend')}
                />
              )}
              <Menu.Item title="Supprimer" onPress={choose('delete')} />
            </Menu>
          )
        }
      />
    </SettingsCard>
  );
};

// The mockups' account cards: 14 dp under the header, 10 dp apart.
const FIRST_CARD_TOP = 14;
const CARD_GAP = 10;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: {
    paddingTop: FIRST_CARD_TOP,
    paddingHorizontal: spacing.md,
    gap: CARD_GAP,
  },
});
