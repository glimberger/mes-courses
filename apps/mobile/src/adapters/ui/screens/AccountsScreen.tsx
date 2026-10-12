import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Appbar, Chip, List, Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { AccountSummary } from '@mes-courses/sync-core';

import { AppbarIconAction } from '../components/AppbarIconAction';
import { BackAction } from '../components/BackAction';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { formatLastSync } from '../components/format-last-sync';
import { LoadingState } from '../components/LoadingState';
import { StateLayout } from '../components/StateLayout';
import { SyncStatusBar } from '../components/SyncStatusBar';
import { useAppStore } from '../state/use-app-store';
import { spacing } from '../theme/spacing';
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

  return (
    <View style={styles.screen}>
      <Appbar.Header>
        {navigation.canGoBack() && (
          <BackAction onPress={() => navigation.goBack()} />
        )}
        <Appbar.Content title="Comptes" />
        <AppbarIconAction
          icon="account-plus"
          accessibilityLabel="Inviter"
          onPress={() => setInviting(true)}
        />
      </Appbar.Header>
      <SyncStatusBar />
      <AccountsView
        state={state}
        onRetry={load}
        onInvite={() => setInviting(true)}
      />
      {inviting && <InviteAccountDialog onClose={closeInvite} />}
    </View>
  );
};

export type AccountsViewProps = {
  state: AccountsState;
  onRetry: () => void;
  onInvite: () => void;
};

/** The content of Accounts, its state given as a prop so a story can show each one. */
export const AccountsView = ({
  state,
  onRetry,
  onInvite,
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
          renderItem={({ item }) => <AccountRow account={item} />}
        />
      );
  }
};

const AccountRow = ({ account }: { account: AccountSummary }) => (
  <List.Item
    title={account.email}
    description={() => (
      <View style={styles.description}>
        <View style={styles.chip}>
          <Chip compact>{stateLabel(account)}</Chip>
        </View>
        <Text variant="bodyMedium">
          Dernière synchronisation :{' '}
          {formatLastSync(account.lastSyncAt, new Date())}
        </Text>
      </View>
    )}
  />
);

const styles = StyleSheet.create({
  screen: { flex: 1 },
  description: { gap: spacing.xs },
  chip: { alignSelf: 'flex-start' },
});
