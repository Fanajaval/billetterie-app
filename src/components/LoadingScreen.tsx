import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../theme";

export function LoadingScreen({ label = "Chargement…" }: { label?: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.bg,
          gap: 16,
        },
        text: {
          fontSize: 15,
          color: colors.textMuted,
          fontWeight: "500",
        },
      }),
    [colors],
  );

  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}
