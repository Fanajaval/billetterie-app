import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Appearance, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { LoadingScreen } from "./src/components/LoadingScreen";
import { getSettings, saveSettings, type ThemeMode } from "./src/lib/settings";
import { buildTheme, ThemeContext } from "./src/theme";

const AppShell = lazy(() =>
  import("./src/components/AppShell").then((m) => ({ default: m.AppShell })),
);

export default function App() {
  const systemScheme = Appearance.getColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");

  useEffect(() => {
    void getSettings().then((settings) => {
      setThemeMode(settings.themeMode);
    });
  }, []);

  const resolvedMode =
    themeMode === "system"
      ? systemScheme === "dark"
        ? "dark"
        : "light"
      : themeMode;
  const theme = useMemo(() => buildTheme(resolvedMode), [resolvedMode]);

  const handleThemeModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    void saveSettings({ themeMode: mode });
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: theme.colors.bg,
        },
      }),
    [theme],
  );

  return (
    <ThemeContext.Provider value={theme}>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <StatusBar style={resolvedMode === "dark" ? "light" : "dark"} />
          <Suspense fallback={<LoadingScreen label="Préparation de l'app…" />}>
            <AppShell
              themeMode={themeMode}
              onThemeModeChange={handleThemeModeChange}
            />
          </Suspense>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ThemeContext.Provider>
  );
}
