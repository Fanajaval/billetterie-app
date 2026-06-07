import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";

import { fitNumberFontSize } from "../lib/ticketText";

export type Box = { x: number; y: number; w: number; h: number };

type DraggableBoxProps = {
  box: Box;
  preview?: string;
  previewFitText?: string;
  label?: string;
  borderColor: string;
  backgroundColor: string;
  textColor: string;
  parentW: number;
  parentH: number;
  minSize?: number;
  active?: boolean;
  lockAspectRatio?: boolean;
  onSelect: () => void;
  onChange: (box: Box) => void;
};

export function DraggableBox({
  box,
  preview,
  previewFitText,
  label,
  borderColor,
  backgroundColor,
  textColor,
  parentW,
  parentH,
  minSize = 32,
  active = false,
  lockAspectRatio,
  onSelect,
  onChange,
}: DraggableBoxProps) {
  const x = useSharedValue(box.x);
  const y = useSharedValue(box.y);
  const w = useSharedValue(box.w);
  const h = useSharedValue(box.h);

  useEffect(() => {
    x.value = box.x;
    y.value = box.y;
    w.value = box.w;
    h.value = box.h;
  }, [box.x, box.y, box.w, box.h, x, y, w, h]);

  const commit = () => onChange({ x: x.value, y: y.value, w: w.value, h: h.value });

  const pan = Gesture.Pan()
    .minDistance(0)
    .onStart(() => runOnJS(onSelect)())
    .onChange((e) => {
      x.value = Math.max(0, Math.min(parentW - w.value, x.value + e.changeX));
      y.value = Math.max(0, Math.min(parentH - h.value, y.value + e.changeY));
    })
    .onEnd(() => runOnJS(commit)());

  const resize = Gesture.Pan()
    .minDistance(0)
    .onStart(() => runOnJS(onSelect)())
    .onChange((e) => {
      const nw = Math.max(minSize, Math.min(parentW - x.value, w.value + e.changeX));
      const nh = lockAspectRatio
        ? nw
        : Math.max(minSize * 0.5, Math.min(parentH - y.value, h.value + e.changeY));
      w.value = nw;
      h.value = nh;
    })
    .onEnd(() => runOnJS(commit)());

  const boxStyle = useAnimatedStyle(() => ({
    left: x.value,
    top: y.value,
    width: w.value,
    height: h.value,
  }));

  const fontSize = preview
    ? fitNumberFontSize(previewFitText ?? preview, box.w, box.h)
    : 12;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.box,
        boxStyle,
        {
          borderColor,
          backgroundColor,
          borderWidth: active ? 3 : 2,
          opacity: active ? 1 : 0.55,
          zIndex: active ? 10 : 1,
        },
      ]}
    >
      <GestureDetector gesture={pan}>
        <View style={styles.body}>
          {preview ? (
            <Text
              style={[
                styles.preview,
                {
                  fontSize,
                  color: "#111111",
                  textShadowColor: "#ffffff",
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: Math.max(2, fontSize * 0.15),
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
            >
              {preview}
            </Text>
          ) : (
            <View style={styles.qrGrid}>
              <View style={[styles.qrCell, { backgroundColor: textColor }]} />
              <View style={styles.qrCell} />
              <View style={styles.qrCell} />
              <View style={[styles.qrCell, { backgroundColor: textColor }]} />
            </View>
          )}
        </View>
      </GestureDetector>

      {label && (
        <View style={[styles.labelBadge, { backgroundColor: borderColor }]}>
          <Text style={styles.labelBadgeText}>{label}</Text>
        </View>
      )}

      <GestureDetector gesture={resize}>
        <View style={[styles.handle, { backgroundColor: borderColor }]}>
          <Text style={styles.handleIcon}>⤡</Text>
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: "absolute",
    borderRadius: 6,
    overflow: "visible",
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  preview: {
    fontWeight: "800",
    textAlign: "center",
  },
  qrGrid: {
    width: "70%",
    height: "70%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
  },
  qrCell: {
    width: "46%",
    height: "46%",
    backgroundColor: "rgba(0,0,0,0.08)",
    borderRadius: 2,
  },
  labelBadge: {
    position: "absolute",
    top: -10,
    left: 6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  labelBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  handle: {
    position: "absolute",
    right: -18,
    bottom: -18,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  handleIcon: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
