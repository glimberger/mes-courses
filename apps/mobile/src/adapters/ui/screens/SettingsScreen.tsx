import { ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, List, Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { BackAction } from '../components/BackAction';
import { Button } from '../components/Button';
import { formatLastSync } from '../components/format-last-sync';
import type { RootStackParamList } from '../routes';
import { useAppStore } from '../state/use-app-store';
import { spacing } from '../theme/spacing';

/** The address as people say it: without the scheme. */
const withoutScheme = (url: string) => url.replace(/^https?:\/\//, '');

/**
 * Settings (US4-1, US4-8): offers to connect a device that never was, and shows the server of one
 * that is.
 */
export const SettingsScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { connection, serverUrl, lastSyncAt } = useAppStore(
    (state) => state.sync,
  );
  return (
    <SettingsView
      onBack={navigation.canGoBack() ? () => navigation.goBack() : null}
      onConnect={() => navigation.navigate('ConnectServer')}
      server={
        connection === 'notConnected' || serverUrl === null
          ? null
          : { url: serverUrl, lastSyncAt }
      }
    />
  );
};

export type SettingsViewProps = {
  onBack: (() => void) | null;
  onConnect: () => void;
  /** The server this device is connected to, or null when it never was. */
  server: { url: string; lastSyncAt: string | null } | null;
};

/** The content of Settings, its data given as props so a story can show each state. */
export const SettingsView = ({
  onBack,
  onConnect,
  server,
}: SettingsViewProps) => (
  <View style={styles.screen}>
    <Appbar.Header>
      {onBack && <BackAction onPress={onBack} />}
      <Appbar.Content title="Réglages" />
    </Appbar.Header>
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
        </>
      )}
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md },
});
