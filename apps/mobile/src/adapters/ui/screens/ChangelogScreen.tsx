import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';

import type { ChangelogRelease } from '../../../application/ports/changelog';
import { useChangelog } from '../changelog-context';
import { CategoryHeader } from '../components/CategoryHeader';
import { EmptyState } from '../components/EmptyState';
import { ScreenHeader } from '../components/ScreenHeader';
import { SettingsCard } from '../components/SettingsCard';
import { spacing } from '../theme/spacing';
import type { AppTheme } from '../theme/theme';

/** `2026-11-09` as "9 novembre 2026"; the text itself when it is not a date. */
const formatDate = (date: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  const parsed = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
};

const Entries = ({
  title,
  entries,
}: {
  title: string;
  entries: ChangelogRelease['features'];
}) =>
  entries.length === 0 ? null : (
    <View style={styles.entries}>
      <Text variant="titleSmall" accessibilityRole="header">
        {title}
      </Text>
      {entries.map((entry, index) => (
        <Text key={`${index}-${entry.text}`} variant="bodyMedium">
          {`• ${entry.text}`}
        </Text>
      ))}
    </View>
  );

const ReleaseCard = ({ release }: { release: ChangelogRelease }) => {
  const { colors } = useTheme() as AppTheme;
  const empty = release.features.length === 0 && release.fixes.length === 0;
  return (
    <>
      <CategoryHeader title={`Version ${release.version}`} />
      <View style={styles.cards}>
        <SettingsCard>
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
            {formatDate(release.date)}
          </Text>
          <Entries title="Nouveautés" entries={release.features} />
          <Entries title="Corrections" entries={release.fixes} />
          {empty && <Text variant="bodyMedium">Aucun changement notable.</Text>}
        </SettingsCard>
      </View>
    </>
  );
};

/** The content of Nouveautés, its releases given as props so a story can show each state. */
export const ChangelogView = ({
  releases,
  onBack,
}: {
  releases: readonly ChangelogRelease[];
  onBack: (() => void) | undefined;
}) => (
  <View style={styles.screen}>
    <ScreenHeader variant="center" title="Nouveautés" onBack={onBack} />
    {releases.length === 0 ? (
      <EmptyState
        icon="info"
        title="Aucune nouveauté"
        message="Les changements des versions publiées apparaîtront ici."
      />
    ) : (
      <ScrollView contentContainerStyle={styles.content}>
        {releases.map((release) => (
          <ReleaseCard key={release.version} release={release} />
        ))}
      </ScrollView>
    )}
  </View>
);

/**
 * Nouveautés: the released versions, newest first, each with its date and its "Nouveautés" and
 * "Corrections" lines, read from the changelog embedded in the app (no network call).
 */
export const ChangelogScreen = () => {
  const navigation = useNavigation();
  const releases = useChangelog();
  return (
    <ChangelogView
      releases={releases}
      onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
    />
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: spacing.xl },
  cards: { paddingHorizontal: spacing.md },
  entries: { gap: spacing.xs },
});
