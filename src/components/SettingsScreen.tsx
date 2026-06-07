import { useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ThemeMode } from "../lib/settings";
import { useAppTheme } from "../theme";

type SettingsScreenProps = {
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
};

export function SettingsScreen({
  themeMode,
  onThemeModeChange,
}: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors, radius, mode } = useAppTheme();

  const quickDarkMode =
    themeMode === "dark" || (themeMode === "system" && mode === "dark");

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.bg },
        scroll: { paddingHorizontal: 16, gap: 16 },
        heroCard: {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: 20,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 14,
        },
        heroTop: {
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        },
        heroIcon: {
          width: 48,
          height: 48,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primaryLight,
          borderWidth: 1,
          borderColor: colors.border,
        },
        heroIconText: {
          fontSize: 22,
        },
        heroEyebrow: {
          alignSelf: "flex-start",
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 999,
          backgroundColor: colors.primaryLight,
        },
        heroEyebrowText: {
          color: colors.primary,
          fontSize: 12,
          fontWeight: "800",
          letterSpacing: 0.4,
        },
        title: { fontSize: 26, fontWeight: "800", color: colors.text },
        subtitle: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
        section: { gap: 12 },
        sectionHeader: { gap: 4 },
        sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
        sectionSubtitle: {
          fontSize: 13,
          color: colors.textMuted,
          lineHeight: 18,
        },
        card: {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        },
        row: {
          paddingHorizontal: 16,
          paddingVertical: 16,
          gap: 6,
        },
        rowTop: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        },
        rowTitle: {
          fontSize: 16,
          fontWeight: "700",
          color: colors.text,
          flex: 1,
        },
        rowDesc: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
        versionCard: {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
          alignItems: "center",
          gap: 4,
        },
        versionText: {
          fontSize: 13,
          color: colors.textMuted,
          fontWeight: "600",
        },
        versionNumber: {
          fontSize: 13,
          color: colors.primary,
          fontWeight: "800",
        },
      }),
    [colors, radius],
  );

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <View style={styles.heroEyebrow}>
                <Text style={styles.heroEyebrowText}>PARAMÈTRES</Text>
              </View>
            </View>
            <View style={styles.heroIcon}>
              <Text style={styles.heroIconText}>⚙️</Text>
            </View>
          </View>
          <Text style={styles.title}>Paramètres</Text>
          <Text style={styles.subtitle}>
            Configurez l'affichage de l'application selon vos préférences.
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Affichage</Text>
            <Text style={styles.sectionSubtitle}>
              Basculez entre le mode clair et le mode sombre.
            </Text>
          </View>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowTop}>
                <Text style={styles.rowTitle}>Mode sombre</Text>
                <Switch
                  value={quickDarkMode}
                  onValueChange={(value) =>
                    onThemeModeChange(value ? "dark" : "light")
                  }
                  trackColor={{
                    false: colors.border,
                    true: colors.primaryLight,
                  }}
                  thumbColor={quickDarkMode ? colors.primary : colors.surface}
                />
              </View>
              <Text style={styles.rowDesc}>
                Activez un affichage sombre, plus confortable pour les yeux.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.versionCard}>
          <Text style={styles.versionText}>Billetterie App</Text>
          <Text style={styles.versionNumber}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}
