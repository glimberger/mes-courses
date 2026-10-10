import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Appbar, HelperText, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Device from 'expo-device';

import { useAnnouncement } from '../accessibility/announce';
import { BackAction } from '../components/BackAction';
import { Button } from '../components/Button';
import type { RootStackParamList } from '../routes';
import type { AppState } from '../state/app-store';
import { useAppStore } from '../state/use-app-store';
import { spacing } from '../theme/spacing';

/** A device name has at most 60 characters (FR-019c). */
const MAX_DEVICE_NAME = 60;

type ConnectFailure = Extract<
  Awaited<ReturnType<AppState['connectToServer']>>,
  { ok: false }
>['error'];

/** The French text of each way the connection can be refused (contracts/ui-screens.md). */
export const connectErrorText = (error: ConnectFailure): string | null => {
  switch (error.type) {
    case 'InvalidUrl':
      return 'Saisissez une adresse comme courses.example.fr.';
    case 'ServerUnreachable':
      return "Impossible de joindre le serveur. Vérifiez l'adresse et votre connexion.";
    case 'UntrustedServer':
      return "La connexion au serveur n'est pas sécurisée. Vérifiez l'adresse ou le certificat du serveur.";
    case 'InvalidCode':
      return "Ce code n'est pas valide ou a expiré. Demandez un nouveau code.";
    case 'TooManyAttempts':
      return `Trop d'essais. Réessayez dans ${error.minutesToWait} ${
        error.minutesToWait === 1 ? 'minute' : 'minutes'
      }.`;
    case 'WriteFailed':
      // The snackbar says so.
      return null;
  }
};

/** Pairs this device with a server (US4-4): address, pairing code and device name. */
export const ConnectServerScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const connectToServer = useAppStore((state) => state.connectToServer);
  const [address, setAddress] = useState('');
  const [code, setCode] = useState('');
  const [deviceName, setDeviceName] = useState(capped(Device.modelName ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const connect = async () => {
    setSaving(true);
    setError(null);
    const outcome = await connectToServer(address, code, deviceName.trim());
    setSaving(false);
    if (outcome.ok) {
      navigation.goBack();
      return;
    }
    // The form stays as typed.
    setError(connectErrorText(outcome.error));
  };

  return (
    <ConnectServerForm
      onBack={navigation.canGoBack() ? () => navigation.goBack() : null}
      address={address}
      onChangeAddress={setAddress}
      code={code}
      onChangeCode={setCode}
      deviceName={deviceName}
      onChangeDeviceName={(text) => setDeviceName(capped(text))}
      error={error}
      saving={saving}
      onSubmit={() => void connect()}
    />
  );
};

const capped = (text: string) =>
  Array.from(text).slice(0, MAX_DEVICE_NAME).join('');

export type ConnectServerFormProps = {
  onBack: (() => void) | null;
  address: string;
  onChangeAddress: (text: string) => void;
  code: string;
  onChangeCode: (text: string) => void;
  deviceName: string;
  onChangeDeviceName: (text: string) => void;
  /** The French message of the last refusal, announced as it appears (FR-038). */
  error: string | null;
  saving: boolean;
  onSubmit: () => void;
};

/**
 * The form of ConnectServer, its values, error and callbacks given as props, so a story can show
 * each outcome.
 */
export const ConnectServerForm = ({
  onBack,
  address,
  onChangeAddress,
  code,
  onChangeCode,
  deviceName,
  onChangeDeviceName,
  error,
  saving,
  onSubmit,
}: ConnectServerFormProps) => {
  const insets = useSafeAreaInsets();
  useAnnouncement(error);
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <Appbar.Header>
        {onBack && <BackAction onPress={onBack} />}
        <Appbar.Content title="Connecter à un serveur" />
      </Appbar.Header>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.form}
      >
        <TextInput
          mode="outlined"
          label="Adresse du serveur"
          accessibilityLabel="Adresse du serveur"
          placeholder="courses.example.fr"
          value={address}
          onChangeText={onChangeAddress}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          disabled={saving}
        />
        <TextInput
          mode="outlined"
          label="Code d'appairage"
          accessibilityLabel="Code d'appairage"
          placeholder="ABCD-EF23"
          value={code}
          onChangeText={onChangeCode}
          autoCapitalize="characters"
          autoCorrect={false}
          disabled={saving}
        />
        <TextInput
          mode="outlined"
          label="Nom de cet appareil"
          accessibilityLabel="Nom de cet appareil"
          value={deviceName}
          onChangeText={onChangeDeviceName}
          autoCapitalize="sentences"
          disabled={saving}
        />
        {error !== null && <HelperText type="error">{error}</HelperText>}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
        <Button
          mode="contained"
          disabled={saving}
          onPress={onSubmit}
          style={styles.submit}
        >
          Connecter
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  form: { padding: spacing.md, gap: spacing.sm },
  footer: { paddingHorizontal: spacing.md },
  submit: { marginVertical: spacing.sm },
});
