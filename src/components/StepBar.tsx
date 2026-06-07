import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../theme";

const STEPS = ["Importer", "Positionner", "Générer"] as const;

type StepBarProps = {
  current: 0 | 1 | 2;
};

export function StepBar({ current }: StepBarProps) {
  const { colors, radius } = useAppTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          paddingVertical: 14,
          paddingHorizontal: 8,
          borderWidth: 1,
          borderColor: colors.border,
        },
        step: {
          flex: 1,
          alignItems: "center",
          position: "relative",
        },
        dot: {
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: colors.bg,
          borderWidth: 2,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1,
        },
        dotDone: {
          backgroundColor: colors.success,
          borderColor: colors.success,
        },
        dotActive: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        dotText: {
          fontSize: 12,
          fontWeight: "700",
          color: colors.textMuted,
        },
        dotTextActive: {
          color: colors.surface,
        },
        label: {
          fontSize: 11,
          color: colors.textMuted,
          marginTop: 6,
          fontWeight: "500",
        },
        labelActive: {
          color: colors.primary,
          fontWeight: "700",
        },
        line: {
          position: "absolute",
          top: 14,
          left: "55%",
          width: "90%",
          height: 2,
          backgroundColor: colors.border,
          zIndex: 0,
        },
        lineDone: {
          backgroundColor: colors.success,
        },
      }),
    [colors, radius],
  );

  return (
    <View style={styles.row}>
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={label} style={styles.step}>
            <View
              style={[
                styles.dot,
                done && styles.dotDone,
                active && styles.dotActive,
              ]}
            >
              <Text
                style={[
                  styles.dotText,
                  (done || active) && styles.dotTextActive,
                ]}
              >
                {i + 1}
              </Text>
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>
              {label}
            </Text>
            {i < STEPS.length - 1 && (
              <View style={[styles.line, done && styles.lineDone]} />
            )}
          </View>
        );
      })}
    </View>
  );
}
