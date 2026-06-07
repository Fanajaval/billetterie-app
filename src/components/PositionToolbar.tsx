import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { MAX_PLACEMENTS } from "../lib/boxes";
import { useAppTheme } from "../theme";

export type Layer = "qr" | "num";

type PositionToolbarProps = {
  layer: Layer;
  selectedIndex: number;
  placementCount: number;
  onLayerChange: (layer: Layer) => void;
  onSelectIndex: (index: number) => void;
  onAddPlacement: () => void;
  onRemovePlacement: () => void;
  onNudge: (dx: number, dy: number) => void;
  onResize: (factor: number) => void;
  onReset: () => void;
};

export function PositionToolbar({
  layer,
  selectedIndex,
  placementCount,
  onLayerChange,
  onSelectIndex,
  onAddPlacement,
  onRemovePlacement,
  onNudge,
  onResize,
  onReset,
}: PositionToolbarProps) {
  const { colors, radius } = useAppTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          padding: 14,
          gap: 10,
          borderWidth: 1,
          borderColor: colors.border,
        },
        title: {
          fontSize: 14,
          fontWeight: "600",
          color: colors.text,
        },
        tabs: {
          flexDirection: "row",
          gap: 8,
        },
        tab: {
          flex: 1,
          paddingVertical: 12,
          borderRadius: radius.sm,
          alignItems: "center",
          backgroundColor: colors.bg,
          borderWidth: 2,
          borderColor: "transparent",
        },
        tabQr: {
          backgroundColor: colors.qrBg,
          borderColor: colors.qr,
        },
        tabNum: {
          backgroundColor: colors.numBg,
          borderColor: colors.num,
        },
        tabText: {
          fontWeight: "600",
          color: colors.textMuted,
          fontSize: 14,
        },
        tabTextActive: {
          color: colors.text,
        },
        placementRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        placementLabel: {
          fontSize: 13,
          fontWeight: "600",
          color: colors.text,
        },
        placementActions: {
          flexDirection: "row",
          gap: 8,
        },
        iconBtn: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
        },
        iconBtnDisabled: {
          opacity: 0.4,
        },
        addBtn: {},
        addBtnText: {
          color: colors.textOnPrimary,
          fontSize: 24,
          fontWeight: "700",
          lineHeight: 26,
        },
        removeBtn: {
          backgroundColor: colors.bg,
          borderWidth: 1,
          borderColor: colors.border,
        },
        removeBtnText: {
          fontSize: 22,
          fontWeight: "700",
          color: colors.textMuted,
          lineHeight: 24,
        },
        chipsRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
        },
        chip: {
          minWidth: 40,
          height: 40,
          paddingHorizontal: 12,
          borderRadius: radius.sm,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.bg,
          borderWidth: 2,
          borderColor: colors.border,
        },
        chipText: {
          fontSize: 14,
          fontWeight: "700",
          color: colors.textMuted,
        },
        chipTextActive: {
          color: colors.text,
        },
        chipAdd: {
          width: 40,
          height: 40,
          borderRadius: radius.sm,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2,
          borderColor: colors.border,
          borderStyle: "dashed",
          backgroundColor: colors.bg,
        },
        chipAddText: {
          fontSize: 22,
          fontWeight: "700",
          lineHeight: 24,
        },
        hint: {
          fontSize: 12,
          color: colors.textMuted,
          lineHeight: 18,
        },
        controls: {
          flexDirection: "row",
          gap: 12,
        },
        arrows: {
          gap: 8,
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        },
        arrowRow: { flexDirection: "row", gap: 8, alignItems: "center" },
        arrowBtn: {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.bg,
          borderWidth: 1,
          borderColor: colors.border,
        },
        arrowCenter: { width: 44, height: 44 },
        arrow: { fontSize: 18, fontWeight: "700", color: colors.text },
        sizeCol: { flex: 1, gap: 8 },
        sizeBtn: {
          backgroundColor: colors.bg,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: 12,
          alignItems: "center",
        },
        sizeBtnText: { color: colors.text, fontWeight: "600" },
        resetBtn: {
          backgroundColor: colors.surfaceAlt,
          borderRadius: radius.sm,
          paddingVertical: 12,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.border,
        },
        resetBtnText: { color: colors.primary, fontWeight: "700" },
      }),
    [colors, radius],
  );
  const accent = layer === "qr" ? colors.qr : colors.num;
  const accentBg = layer === "qr" ? colors.qrBg : colors.numBg;
  const canAdd = placementCount < MAX_PLACEMENTS;
  const canRemove = placementCount > 1;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Que voulez-vous déplacer ?</Text>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, layer === "qr" && styles.tabQr]}
          onPress={() => onLayerChange("qr")}
        >
          <Text
            style={[styles.tabText, layer === "qr" && styles.tabTextActive]}
          >
            QR Code
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, layer === "num" && styles.tabNum]}
          onPress={() => onLayerChange("num")}
        >
          <Text
            style={[styles.tabText, layer === "num" && styles.tabTextActive]}
          >
            Numéro
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.placementRow}>
        <Text style={styles.placementLabel}>
          {layer === "qr" ? "Emplacements QR" : "Emplacements numéro"}
        </Text>
        <View style={styles.placementActions}>
          {canRemove && (
            <TouchableOpacity
              style={[styles.iconBtn, styles.removeBtn]}
              onPress={onRemovePlacement}
              accessibilityLabel="Supprimer cet emplacement"
            >
              <Text style={styles.removeBtnText}>−</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.iconBtn,
              styles.addBtn,
              { backgroundColor: accent },
              !canAdd && styles.iconBtnDisabled,
            ]}
            onPress={onAddPlacement}
            disabled={!canAdd}
            accessibilityLabel="Ajouter un emplacement"
          >
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.chipsRow}>
        {Array.from({ length: placementCount }, (_, i) => {
          const active = selectedIndex === i;
          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.chip,
                active && { backgroundColor: accentBg, borderColor: accent },
              ]}
              onPress={() => onSelectIndex(i)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {i + 1}
              </Text>
            </TouchableOpacity>
          );
        })}
        {canAdd && (
          <TouchableOpacity style={styles.chipAdd} onPress={onAddPlacement}>
            <Text style={[styles.chipAddText, { color: accent }]}>+</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.hint}>
        Touchez + pour dupliquer le même {layer === "qr" ? "QR code" : "numéro"}{" "}
        · Glissez la zone · Zoomez · Flèches pour affiner · Poignée ⤡ pour la
        taille
      </Text>

      <View style={styles.controls}>
        <View style={styles.arrows}>
          <View style={styles.arrowRow}>
            <TouchableOpacity
              style={styles.arrowBtn}
              onPress={() => onNudge(0, -0.01)}
            >
              <Text style={styles.arrow}>▲</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.arrowRow}>
            <TouchableOpacity
              style={styles.arrowBtn}
              onPress={() => onNudge(-0.01, 0)}
            >
              <Text style={styles.arrow}>◀</Text>
            </TouchableOpacity>
            <View style={styles.arrowCenter} />
            <TouchableOpacity
              style={styles.arrowBtn}
              onPress={() => onNudge(0.01, 0)}
            >
              <Text style={styles.arrow}>▶</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.arrowRow}>
            <TouchableOpacity
              style={styles.arrowBtn}
              onPress={() => onNudge(0, 0.01)}
            >
              <Text style={styles.arrow}>▼</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sizeCol}>
          <TouchableOpacity
            style={styles.sizeBtn}
            onPress={() => onResize(1.08)}
          >
            <Text style={styles.sizeBtnText}>Agrandir</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sizeBtn}
            onPress={() => onResize(0.92)}
          >
            <Text style={styles.sizeBtnText}>Réduire</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resetBtn} onPress={onReset}>
            <Text style={styles.resetBtnText}>Réinitialiser</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
