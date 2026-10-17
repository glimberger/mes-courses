import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Device from 'expo-device';

import { useAnnouncement } from '../accessibility/announce';
import { BackAction } from '../components/BackAction';
import { BrandImage } from '../components/BrandImage';
import { Button } from '../components/Button';
import { fieldStyle } from '../components/field-style';
import { PasswordField } from '../components/PasswordField';
import { VisuallyHidden } from '../components/VisuallyHidden';
import { ForgotPasswordDialog } from './ForgotPasswordDialog';
import type { RootStackParamList } from '../routes';
import type { AppState } from '../state/app-store';
import { useAppStore } from '../state/use-app-store';
import { spacing } from '../theme/spacing';
import type { AppTheme } from '../theme/theme';

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
  // The address used last comes first; a build made for one server (staging) suggests its own.
  const [address, setAddress] = useState(
    withoutScheme(
      lastServerUrl ?? process.env.EXPO_PUBLIC_DEFAULT_SERVER_URL ?? '',
    ),
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
    // A phone that reports no model still needs a name: the server refuses an empty one.
    const name = deviceName.trim() || 'Mon appareil';
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
 * outcome. The mockup has no app bar: the screen name is a heading for screen readers only, and
 * "Retour", when there is a screen to go back to, sits above the brand tile.
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
  const theme = useTheme() as AppTheme;
  const [brandFailed, setBrandFailed] = useState(false);
  useAnnouncement(error);
  const field = fieldStyle('screen', theme);
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.form,
          { paddingTop: insets.top + FORM_TOP, paddingBottom: insets.bottom },
        ]}
      >
        <VisuallyHidden role="header">Se connecter</VisuallyHidden>
        {onBack && (
          <View style={styles.back}>
            <BackAction onPress={onBack} />
          </View>
        )}
        <View style={styles.brand}>
          {brandFailed ? (
            <Text accessibilityRole="header" variant="headlineLarge">
              Mes Courses
            </Text>
          ) : (
            <BrandImage onError={() => setBrandFailed(true)} />
          )}
        </View>
        <TextInput
          {...field}
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
          {...field}
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
          {...field}
          label="Nom de cet appareil"
          accessibilityLabel="Nom de cet appareil"
          value={deviceName}
          onChangeText={onChangeDeviceName}
          autoCapitalize="sentences"
          disabled={saving}
        />
        {error !== null && <HelperText type="error">{error}</HelperText>}
        <Button
          mode="brand"
          disabled={saving}
          onPress={onSubmit}
          style={styles.submit}
        >
          Se connecter
        </Button>
        <Button mode="text" disabled={saving} onPress={onForgotPassword}>
          Mot de passe oublié ?
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// The mockups' sign-in measures (`.screen` padding and gaps), off the 4 dp grid.
const FORM_TOP = 14;
const FIELD_GAP = 15;
const SUBMIT_GAP = 10;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  back: { alignSelf: 'flex-start' },
  brand: { alignItems: 'center', gap: spacing.sm },
  form: {
    paddingHorizontal: spacing.lg,
    gap: FIELD_GAP,
  },
  submit: { marginTop: SUBMIT_GAP },
});
