import { useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
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
  const resolvedLabel = mode === "dark" ? "Sombre" : "Clair";
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.bg },
        scroll: { paddingHorizontal: 16, gap: 16 },
        heroCard: {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: 18,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 10,
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
        sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
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
          gap: 4,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        rowLast: { borderBottomWidth: 0 },
        rowActive: { backgroundColor: colors.primaryLight },
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
        badge: {
          alignSelf: "flex-start",
          marginTop: 6,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: colors.surfaceAlt,
        },
        badgeText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
        stateGrid: { flexDirection: "row", gap: 10 },
        stateTile: {
          flex: 1,
          backgroundColor: colors.surfaceSoft,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 14,
          gap: 4,
        },
        stateTileLabel: {
          fontSize: 12,
          color: colors.textMuted,
          fontWeight: "600",
        },
        stateTileValue: {
          fontSize: 16,
          color: colors.text,
          fontWeight: "800",
        },
        infoCard: {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
          gap: 8,
        },
        infoText: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
        helperCard: {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
          gap: 10,
        },
        helperTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
        helperText: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
      }),
    [colors, radius],
  );

  const quickDarkMode =
    themeMode === "dark" || (themeMode === "system" && mode === "dark");

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroEyebrow}>
            <Text style={styles.heroEyebrowText}>PERSONNALISATION</Text>
          </View>
          <Text style={styles.title}>Paramètres</Text>
          <Text style={styles.subtitle}>
            Gérez les préférences essentielles de l'application. Les changements
            s'appliquent immédiatement dans tous les menus.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Accès rapide</Text>
          <View style={styles.card}>
            <View style={[styles.row, styles.rowLast]}>
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
                Activez rapidement un affichage sombre confortable pour les
                yeux.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Apparence</Text>
          <View style={styles.card}>
            {[
              [
                "system",
                "Suivre le système",
                "Utilise automatiquement le thème du téléphone.",
              ],
              ["light", "Mode clair", "Affichage lumineux, idéal en journée."],
              [
                "dark",
                "Mode sombre",
                "Affichage plus doux pour les environnements sombres.",
              ],
            ].map(([value, label, desc], index, array) => {
              const selected = themeMode === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.row,
                    index === array.length - 1 && styles.rowLast,
                    selected && styles.rowActive,
                  ]}
                  onPress={() => onThemeModeChange(value as ThemeMode)}
                >
                  <View style={styles.rowTop}>
                    <Text style={styles.rowTitle}>{label}</Text>
                  </View>
                  <Text style={styles.rowDesc}>{desc}</Text>
                  {selected ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>SÉLECTIONNÉ</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>État actuel</Text>
          <View style={styles.infoCard}>
            <View style={styles.stateGrid}>
              <View style={styles.stateTile}>
                <Text style={styles.stateTileLabel}>Thème actif</Text>
                <Text style={styles.stateTileValue}>{resolvedLabel}</Text>
              </View>
              <View style={styles.stateTile}>
                <Text style={styles.stateTileLabel}>Source</Text>
                <Text style={styles.stateTileValue}>
                  {themeMode === "system" ? "Système" : "Manuelle"}
                </Text>
              </View>
            </View>
            <Text style={styles.infoText}>
              Préférence enregistrée :
              {themeMode === "system"
                ? " Suivre le système"
                : themeMode === "dark"
                  ? " Mode sombre"
                  : " Mode clair"}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>À propos des réglages</Text>
          <View style={styles.helperCard}>
            <Text style={styles.helperTitle}>Application moderne</Text>
            <Text style={styles.helperText}>
              Les paramètres servent à personnaliser l'expérience de
              l'utilisateur. Le mode clair/sombre est appliqué immédiatement sur
              l'ensemble de l'application pour une expérience cohérente.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
