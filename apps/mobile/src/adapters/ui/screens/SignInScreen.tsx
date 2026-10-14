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
import { PasswordField } from '../components/PasswordField';
import { ForgotPasswordDialog } from './ForgotPasswordDialog';
import type { RootStackParamList } from '../routes';
import type { AppState } from '../state/app-store';
import { useAppStore } from '../state/use-app-store';
import { spacing } from '../theme/spacing';

/** A device name has at most 60 characters (FR-019c). */
const MAX_DEVICE_NAME = 60;

type SignInFailure = Extract<
  Awaited<ReturnType<AppState['signIn']>>,
  { ok: false }
>['error'];

/** The French text of each way a sign-in can be refused (contracts/ui-screens.md). */
export const signInErrorText = (error: SignInFailure): string | null => {
  switch (error.type) {
    case 'InvalidUrl':
      return 'Saisissez une adresse comme courses.example.fr.';
    case 'InvalidEmail':
      return 'Saisissez une adresse e-mail valide.';
    case 'InvalidCredentials':
      // Never says which of the two is wrong (US2-4).
      return 'Adresse e-mail ou mot de passe incorrect.';
    case 'TemporaryPasswordExpired':
      return 'Ce mot de passe temporaire a expiré. Choisissez « Mot de passe oublié ? » pour en recevoir un nouveau.';
    case 'AccountSuspended':
      return "Ce compte est suspendu. Contactez l'administrateur du serveur.";
    case 'TooManyAttempts':
      return `Trop d'essais. Réessayez dans ${error.minutesToWait} ${
        error.minutesToWait === 1 ? 'minute' : 'minutes'
      }.`;
    case 'ServerUnreachable':
      return "Impossible de joindre le serveur. Vérifiez l'adresse et votre connexion.";
    case 'UntrustedServer':
      return "La connexion au serveur n'est pas sécurisée. Vérifiez l'adresse ou le certificat du serveur.";
    case 'UpdateRequired':
      return "Mettez à jour l'application pour synchroniser.";
    case 'WriteFailed':
      // The snackbar says so.
      return null;
  }
};

const capped = (text: string) =>
  Array.from(text).slice(0, MAX_DEVICE_NAME).join('');

/** The address as people say it: without the scheme. */
const withoutScheme = (url: string) => url.replace(/^https?:\/\//, '');

/** Signs this device in (US2-1): server address, email, password and device name. */
export const SignInScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const signIn = useAppStore((state) => state.signIn);
  const lastServerUrl = useAppStore((state) => state.sync.serverUrl);
  const [address, setAddress] = useState(
    lastServerUrl === null ? '' : withoutScheme(lastServerUrl),
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [deviceName, setDeviceName] = useState(capped(Device.modelName ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [forgotten, setForgotten] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const name = deviceName.trim();
    const outcome = await signIn(address, email, password, name);
    setSaving(false);
    if (!outcome.ok) {
      // The form stays as typed.
      setError(signInErrorText(outcome.error));
      return;
    }
    if (outcome.value.type === 'passwordChangeRequired') {
      navigation.navigate('ChoosePassword', {
        url: address,
        email,
        temporaryPassword: password,
        deviceName: name,
      });
      return;
    }
    navigation.goBack();
  };

  return (
    <>
      <SignInForm
        onBack={navigation.canGoBack() ? () => navigation.goBack() : null}
        address={address}
        onChangeAddress={setAddress}
        email={email}
        onChangeEmail={setEmail}
        password={password}
        onChangePassword={setPassword}
        deviceName={deviceName}
        onChangeDeviceName={(text) => setDeviceName(capped(text))}
        error={error}
        saving={saving}
        onSubmit={() => void submit()}
        onForgotPassword={() => setForgotten(true)}
      />
      {forgotten && (
        <ForgotPasswordDialog
          address={address}
          initialEmail={email}
          onClose={() => setForgotten(false)}
        />
      )}
    </>
  );
};

export type SignInFormProps = {
  onBack: (() => void) | null;
  address: string;
  onChangeAddress: (text: string) => void;
  email: string;
  onChangeEmail: (text: string) => void;
  password: string;
  onChangePassword: (text: string) => void;
  deviceName: string;
  onChangeDeviceName: (text: string) => void;
  /** The French message of the last refusal, announced as it appears (FR-038). */
  error: string | null;
  saving: boolean;
  onSubmit: () => void;
  onForgotPassword: () => void;
};

/**
 * The form of SignIn, its values, error and callbacks given as props, so a story can show each
 * outcome.
 */
export const SignInForm = ({
  onBack,
  address,
  onChangeAddress,
  email,
  onChangeEmail,
  password,
  onChangePassword,
  deviceName,
  onChangeDeviceName,
  error,
  saving,
  onSubmit,
  onForgotPassword,
}: SignInFormProps) => {
  const insets = useSafeAreaInsets();
  useAnnouncement(error);
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <Appbar.Header>
        {onBack && <BackAction onPress={onBack} />}
        <Appbar.Content title="Se connecter" />
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
          label="Adresse e-mail"
          accessibilityLabel="Adresse e-mail"
          value={email}
          onChangeText={onChangeEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          disabled={saving}
        />
        <PasswordField
          label="Mot de passe"
          value={password}
          onChangeText={onChangePassword}
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
          Se connecter
        </Button>
        <Button mode="text" disabled={saving} onPress={onForgotPassword}>
          Mot de passe oublié ?
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
