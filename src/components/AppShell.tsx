import { lazy, Suspense, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ThemeMode } from "../lib/settings";
import { useAppTheme } from "../theme";
import { LoadingScreen } from "./LoadingScreen";

const TicketBuilder = lazy(() =>
  import("./TicketBuilder").then((m) => ({ default: m.TicketBuilder })),
);
const TicketScanner = lazy(() =>
  import("./TicketScanner").then((m) => ({ default: m.TicketScanner })),
);
const HistoryScreen = lazy(() =>
  import("./HistoryScreen").then((m) => ({ default: m.HistoryScreen })),
);
const SettingsScreen = lazy(() =>
  import("./SettingsScreen").then((m) => ({ default: m.SettingsScreen })),
);

type Tab = "generate" | "scan" | "history" | "settings";

type AppShellProps = {
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
};

export function AppShell({ themeMode, onThemeModeChange }: AppShellProps) {
  const insets = useSafeAreaInsets();
  const { colors, radius } = useAppTheme();
  const [tab, setTab] = useState<Tab>("generate");

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.bg },
        content: { flex: 1 },
        tabBar: {
          flexDirection: "row",
          gap: 8,
          paddingHorizontal: 12,
          paddingTop: 10,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        tabBtn: {
          flex: 1,
          alignItems: "center",
          paddingVertical: 10,
          borderRadius: radius.md,
          backgroundColor: colors.bg,
          gap: 2,
        },
        tabBtnActive: {
          backgroundColor: colors.primaryLight,
          borderWidth: 1,
          borderColor: colors.primary,
        },
        tabIcon: { fontSize: 20, opacity: 0.6 },
        tabIconActive: { opacity: 1 },
        tabLabel: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
        tabLabelActive: { color: colors.primary, fontWeight: "800" },
      }),
    [colors, radius],
  );

  const loadingLabel =
    tab === "generate"
      ? "Chargement du générateur…"
      : tab === "scan"
        ? "Chargement du scanner…"
        : tab === "history"
          ? "Chargement de l'historique…"
          : "Chargement des paramètres…";

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <Suspense fallback={<LoadingScreen label={loadingLabel} />}>
          {tab === "generate" ? (
            <TicketBuilder />
          ) : tab === "scan" ? (
            <TicketScanner />
          ) : tab === "history" ? (
            <HistoryScreen />
          ) : (
            <SettingsScreen
              themeMode={themeMode}
              onThemeModeChange={onThemeModeChange}
            />
          )}
        </Suspense>
      </View>

      <View
        style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}
      >
        {[
          ["generate", "🎫", "Générer"],
          ["scan", "📷", "Scanner"],
          ["history", "🕘", "Historique"],
          ["settings", "⚙️", "Paramètres"],
        ].map(([value, icon, label]) => (
          <TouchableOpacity
            key={value}
            style={[styles.tabBtn, tab === value && styles.tabBtnActive]}
            onPress={() => setTab(value as Tab)}
          >
            <Text
              style={[styles.tabIcon, tab === value && styles.tabIconActive]}
            >
              {icon}
            </Text>
            <Text
              style={[styles.tabLabel, tab === value && styles.tabLabelActive]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
