import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

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
  const [position, setPosition] = useState(box);
  const bodyRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startBoxRef = useRef(box);

  useEffect(() => {
    if (!isDraggingRef.current && !isResizingRef.current) {
      setPosition(box);
    }
  }, [box]);

  useEffect(() => {
    const bodyElement = bodyRef.current;
    const handleElement = handleRef.current;
    if (!bodyElement || !handleElement) return;

    // Drag handler for body
    const handleBodyMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect();
      isDraggingRef.current = true;
      startPosRef.current = { x: e.clientX, y: e.clientY };
      startBoxRef.current = position;
    };

    // Resize handler for handle
    const handleHandleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect();
      isResizingRef.current = true;
      startPosRef.current = { x: e.clientX, y: e.clientY };
      startBoxRef.current = position;
    };

    // Global mouse move
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        const dx = e.clientX - startPosRef.current.x;
        const dy = e.clientY - startPosRef.current.y;
        const newX = Math.max(0, Math.min(parentW - startBoxRef.current.w, startBoxRef.current.x + dx));
        const newY = Math.max(0, Math.min(parentH - startBoxRef.current.h, startBoxRef.current.y + dy));
        setPosition({ ...startBoxRef.current, x: newX, y: newY });
      } else if (isResizingRef.current) {
        const dx = e.clientX - startPosRef.current.x;
        const dy = e.clientY - startPosRef.current.y;
        const nw = Math.max(minSize, Math.min(parentW - startBoxRef.current.x, startBoxRef.current.w + dx));
        const nh = lockAspectRatio
          ? nw
          : Math.max(minSize * 0.5, Math.min(parentH - startBoxRef.current.y, startBoxRef.current.h + dy));
        setPosition({ ...startBoxRef.current, w: nw, h: nh });
      }
    };

    // Global mouse up
    const handleMouseUp = () => {
      if (isDraggingRef.current || isResizingRef.current) {
        onChange(position);
        isDraggingRef.current = false;
        isResizingRef.current = false;
      }
    };

    bodyElement.addEventListener("mousedown", handleBodyMouseDown);
    handleElement.addEventListener("mousedown", handleHandleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      bodyElement.removeEventListener("mousedown", handleBodyMouseDown);
      handleElement.removeEventListener("mousedown", handleHandleMouseDown);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [position, parentW, parentH, minSize, lockAspectRatio, onSelect, onChange]);

  const fontSize = preview
    ? fitNumberFontSize(previewFitText ?? preview, position.w, position.h)
    : 12;

  return (
    <View
      style={[
        styles.box,
        {
          left: position.x,
          top: position.y,
          width: position.w,
          height: position.h,
          borderColor,
          backgroundColor,
          borderWidth: active ? 3 : 2,
          opacity: active ? 1 : 0.55,
          zIndex: active ? 10 : 1,
        },
      ]}
    >
      <div ref={bodyRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, cursor: 'move' }}>
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
      </div>

      {label && (
        <View style={[styles.labelBadge, { backgroundColor: borderColor }]}>
          <Text style={styles.labelBadgeText}>{label}</Text>
        </View>
      )}

      <div ref={handleRef} style={{
        position: 'absolute',
        right: -18,
        bottom: -18,
        width: 44,
        height: 44,
        borderRadius: 22,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px solid #fff',
        boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
        cursor: 'nwse-resize',
        backgroundColor: borderColor,
      }}>
        <Text style={styles.handleIcon}>⤡</Text>
      </div>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: "absolute",
    borderRadius: 6,
    overflow: "visible",
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
  handleIcon: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
