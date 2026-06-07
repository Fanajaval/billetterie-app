import { useEffect, useMemo, useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";

import { type NormBox, normToPixel, pixelToNorm } from "../lib/boxes";
import { useAppTheme } from "../theme";
import { DraggableBox } from "./DraggableBox";
import { type Layer, PositionToolbar } from "./PositionToolbar";

type TicketCanvasProps = {
  imgUri: string;
  imgW: number;
  imgH: number;
  qrBoxes: NormBox[];
  numBoxes: NormBox[];
  sampleNumber: string;
  longestNumber: string;
  onUpdateQr: (index: number, box: NormBox) => void;
  onUpdateNum: (index: number, box: NormBox) => void;
  onNudgeQr: (index: number, dx: number, dy: number) => void;
  onNudgeNum: (index: number, dx: number, dy: number) => void;
  onResizeQr: (index: number, factor: number) => void;
  onResizeNum: (index: number, factor: number) => void;
  onAddQr: () => void;
  onAddNum: () => void;
  onRemoveQr: (index: number) => void;
  onRemoveNum: (index: number) => void;
  onReset: () => void;
};

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 3;

export function TicketCanvas({
  imgUri,
  imgW,
  imgH,
  qrBoxes,
  numBoxes,
  sampleNumber,
  longestNumber,
  onUpdateQr,
  onUpdateNum,
  onNudgeQr,
  onNudgeNum,
  onResizeQr,
  onResizeNum,
  onAddQr,
  onAddNum,
  onRemoveQr,
  onRemoveNum,
  onReset,
}: TicketCanvasProps) {
  const { colors, radius } = useAppTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { gap: 10 },
        zoomRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          justifyContent: "center",
        },
        zoomBtn: {
          width: 40,
          height: 40,
          borderRadius: radius.sm,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        },
        zoomBtnText: { fontSize: 20, fontWeight: "700", color: colors.text },
        zoomLabel: {
          fontSize: 14,
          fontWeight: "600",
          minWidth: 48,
          textAlign: "center",
          color: colors.text,
        },
        fitBtn: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: radius.sm,
          backgroundColor: colors.bg,
          borderWidth: 1,
          borderColor: colors.border,
        },
        fitBtnText: {
          fontSize: 13,
          color: colors.textMuted,
          fontWeight: "500",
        },
        viewport: {
          alignSelf: "center",
          borderRadius: radius.md,
          backgroundColor: colors.canvas,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.border,
        },
        canvas: {
          position: "relative",
          backgroundColor: colors.canvasSurface,
        },
      }),
    [colors, radius],
  );
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [layer, setLayer] = useState<Layer>("qr");
  const [selectedQrIndex, setSelectedQrIndex] = useState(0);
  const [selectedNumIndex, setSelectedNumIndex] = useState(0);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (selectedQrIndex >= qrBoxes.length) {
      setSelectedQrIndex(Math.max(0, qrBoxes.length - 1));
    }
  }, [qrBoxes.length, selectedQrIndex]);

  useEffect(() => {
    if (selectedNumIndex >= numBoxes.length) {
      setSelectedNumIndex(Math.max(0, numBoxes.length - 1));
    }
  }, [numBoxes.length, selectedNumIndex]);

  const viewportW = screenW - 32;
  const viewportH = Math.min(screenH * 0.42, 380);
  const fitScale = Math.min(viewportW / imgW, viewportH / imgH, 3);
  const displayScale = fitScale * zoom;
  const displayW = imgW * displayScale;
  const displayH = imgH * displayScale;

  const selectedIndex = layer === "qr" ? selectedQrIndex : selectedNumIndex;
  const placementCount = layer === "qr" ? qrBoxes.length : numBoxes.length;

  const toNorm = (px: { x: number; y: number; w: number; h: number }) =>
    pixelToNorm(px, displayW, displayH);

  const changeZoom = (delta: number) =>
    setZoom((z) =>
      Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z + delta).toFixed(2))),
    );

  const handleAddPlacement = () => {
    if (layer === "qr") {
      onAddQr();
      setSelectedQrIndex(qrBoxes.length);
    } else {
      onAddNum();
      setSelectedNumIndex(numBoxes.length);
    }
  };

  const handleRemovePlacement = () => {
    if (layer === "qr") {
      onRemoveQr(selectedQrIndex);
      setSelectedQrIndex((i) => Math.max(0, i - 1));
    } else {
      onRemoveNum(selectedNumIndex);
      setSelectedNumIndex((i) => Math.max(0, i - 1));
    }
  };

  return (
    <View style={styles.wrap}>
      <PositionToolbar
        layer={layer}
        selectedIndex={selectedIndex}
        placementCount={placementCount}
        onLayerChange={setLayer}
        onSelectIndex={(i) =>
          layer === "qr" ? setSelectedQrIndex(i) : setSelectedNumIndex(i)
        }
        onAddPlacement={handleAddPlacement}
        onRemovePlacement={handleRemovePlacement}
        onNudge={(dx, dy) =>
          layer === "qr"
            ? onNudgeQr(selectedQrIndex, dx, dy)
            : onNudgeNum(selectedNumIndex, dx, dy)
        }
        onResize={(f) =>
          layer === "qr"
            ? onResizeQr(selectedQrIndex, f)
            : onResizeNum(selectedNumIndex, f)
        }
        onReset={onReset}
      />

      <View style={styles.zoomRow}>
        <TouchableOpacity
          style={styles.zoomBtn}
          onPress={() => changeZoom(-0.2)}
        >
          <Text style={styles.zoomBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.zoomLabel}>{Math.round(zoom * 100)}%</Text>
        <TouchableOpacity
          style={styles.zoomBtn}
          onPress={() => changeZoom(0.2)}
        >
          <Text style={styles.zoomBtnText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fitBtn} onPress={() => setZoom(1)}>
          <Text style={styles.fitBtnText}>Ajuster</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.viewport, { width: viewportW, height: viewportH }]}>
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            minWidth: viewportW,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              minHeight: viewportH,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={[styles.canvas, { width: displayW, height: displayH }]}
            >
              <Image
                source={{ uri: imgUri }}
                style={{ width: displayW, height: displayH }}
                resizeMode="stretch"
              />

              {qrBoxes.map((box, i) => {
                const px = normToPixel(box, displayW, displayH);
                const active = layer === "qr" && selectedQrIndex === i;
                return (
                  <DraggableBox
                    key={`qr-${i}`}
                    box={px}
                    label={qrBoxes.length > 1 ? String(i + 1) : undefined}
                    borderColor={colors.qr}
                    backgroundColor={colors.qrBg}
                    textColor={colors.qr}
                    parentW={displayW}
                    parentH={displayH}
                    minSize={Math.max(36, displayW * 0.05)}
                    active={active}
                    lockAspectRatio
                    onSelect={() => {
                      setLayer("qr");
                      setSelectedQrIndex(i);
                    }}
                    onChange={(b) => onUpdateQr(i, toNorm(b))}
                  />
                );
              })}

              {numBoxes.map((box, i) => {
                const px = normToPixel(box, displayW, displayH);
                const active = layer === "num" && selectedNumIndex === i;
                return (
                  <DraggableBox
                    key={`num-${i}`}
                    box={px}
                    label={numBoxes.length > 1 ? String(i + 1) : undefined}
                    preview={sampleNumber}
                    previewFitText={longestNumber}
                    borderColor={colors.num}
                    backgroundColor={colors.numBg}
                    textColor={colors.num}
                    parentW={displayW}
                    parentH={displayH}
                    minSize={Math.max(28, displayH * 0.04)}
                    active={active}
                    onSelect={() => {
                      setLayer("num");
                      setSelectedNumIndex(i);
                    }}
                    onChange={(b) => onUpdateNum(i, toNorm(b))}
                  />
                );
              })}
            </View>
          </ScrollView>
        </ScrollView>
      </View>
    </View>
  );
}
