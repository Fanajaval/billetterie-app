import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSharedValue, runOnJS } from "react-native-reanimated";

import { validateQrContent } from "../lib/ticketAuth";
import {
  clearScannedTickets,
  isTicketScanned,
  markTicketScanned,
} from "../lib/scannedTickets";
import { useAppTheme } from "../theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScanState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "valid"; ticket: string; eventId: string; duplicate: boolean }
  | { status: "invalid"; reason: string };

const SCAN_COOLDOWN_MS = 1500;

// expo-camera zoom : 0 = pas de zoom, 1 = zoom maximum de l'appareil.
// On plafonne à 0.5 pour rester dans la plage optique utile.
const ZOOM_MIN = 0;
const ZOOM_MAX = 0.5;

// ---------------------------------------------------------------------------
// Helper worklet-safe
// ---------------------------------------------------------------------------

/** Borne une valeur entre min et max — utilisable depuis le thread UI. */
function clampValue(value: number, min: number, max: number): number {
  "worklet";
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function TicketScanner() {
  const insets = useSafeAreaInsets();
  const { colors, radius } = useAppTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>({ status: "idle" });
  const [paused, setPaused] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoom, setZoom] = useState(ZOOM_MIN);
  const [pinchHintVisible, setPinchHintVisible] = useState(true);
  const lastScanRef = useRef<{ code: string; at: number }>({
    code: "",
    at: 0,
  });

  // -------------------------------------------------------------------------
  // Pinch-to-zoom via Reanimated (thread UI) → runOnJS → setState React
  // -------------------------------------------------------------------------
  // La valeur de zoom vit sur le thread UI pendant le geste pour être fluide,
  // puis est envoyée au thread JS (setState) à chaque frame via runOnJS.
  // CameraView.zoom est une prop React normale (pas animable nativement) donc
  // setState est la seule façon correcte de la mettre à jour.
  const zoomBase = useSharedValue(ZOOM_MIN);

  const applyZoom = useCallback((v: number) => {
    setZoom(v);
  }, []);

  const hidePinchHint = useCallback(() => {
    setPinchHintVisible(false);
  }, []);

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      zoomBase.value = zoom; // snapshot de la valeur JS courante
      runOnJS(hidePinchHint)();
    })
    .onUpdate((e) => {
      // (scale - 1) * sensibilité + base → zoom clamped
      const next = clampValue(
        zoomBase.value + (e.scale - 1) * 0.35,
        ZOOM_MIN,
        ZOOM_MAX,
      );
      runOnJS(applyZoom)(next);
    });

  // -------------------------------------------------------------------------
  // Validation QR
  // -------------------------------------------------------------------------

  const handleBarcode = useCallback(
    async ({ data }: { data: string }) => {
      if (paused) return;

      const now = Date.now();
      if (
        lastScanRef.current.code === data &&
        now - lastScanRef.current.at < SCAN_COOLDOWN_MS
      ) {
        return;
      }
      lastScanRef.current = { code: data, at: now };

      setPaused(true);
      setScanState({ status: "checking" });

      const result = await validateQrContent(data);
      if (!result.valid) {
        setScanState({ status: "invalid", reason: result.reason });
        return;
      }

      const duplicate = await isTicketScanned(result.ticket);
      if (!duplicate) {
        await markTicketScanned(result.ticket, result.eventId);
      }

      setScanState({
        status: "valid",
        ticket: result.ticket,
        eventId: result.eventId,
        duplicate,
      });
    },
    [paused],
  );

  const resetScan = useCallback(() => {
    setScanState({ status: "idle" });
    setPaused(false);
    lastScanRef.current = { code: "", at: 0 };
  }, []);

  const confirmClearHistory = useCallback(() => {
    Alert.alert(
      "Effacer l'historique ?",
      "Les billets déjà scannés pourront être scannés à nouveau.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Effacer",
          style: "destructive",
          onPress: () => void clearScannedTickets().then(resetScan),
        },
      ],
    );
  }, [resetScan]);

  // -------------------------------------------------------------------------
  // Styles
  // -------------------------------------------------------------------------

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.bg },
        centered: {
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        },
        header: { paddingHorizontal: 16, gap: 4 },
        title: { fontSize: 26, fontWeight: "800", color: colors.text },
        subtitle: { fontSize: 14, color: colors.textMuted },
        webMsg: {
          fontSize: 15,
          color: colors.textMuted,
          textAlign: "center",
          lineHeight: 22,
        },
        permText: {
          fontSize: 15,
          color: colors.textMuted,
          textAlign: "center",
          lineHeight: 22,
        },
        cameraWrap: {
          flex: 1,
          marginHorizontal: 16,
          marginTop: 12,
          borderRadius: radius.lg,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.border,
        },
        camera: { flex: 1 },
        // Overlay non-interactif au-dessus de la caméra
        overlay: {
          ...StyleSheet.absoluteFillObject,
          alignItems: "center",
          justifyContent: "center",
        },
        overlayMask: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.42)",
        },
        scanFrameWrap: {
          width: "60%",
          aspectRatio: 1,
        },
        scanFrame: {
          flex: 1,
          borderRadius: 4,
          backgroundColor: "transparent",
        },
        // Coins du cadre
        corner: {
          position: "absolute",
          width: 24,
          height: 24,
          borderColor: "#ffffff",
          borderWidth: 3,
        },
        cornerTL: {
          top: 0,
          left: 0,
          borderRightWidth: 0,
          borderBottomWidth: 0,
          borderTopLeftRadius: 4,
        },
        cornerTR: {
          top: 0,
          right: 0,
          borderLeftWidth: 0,
          borderBottomWidth: 0,
          borderTopRightRadius: 4,
        },
        cornerBL: {
          bottom: 0,
          left: 0,
          borderRightWidth: 0,
          borderTopWidth: 0,
          borderBottomLeftRadius: 4,
        },
        cornerBR: {
          bottom: 0,
          right: 0,
          borderLeftWidth: 0,
          borderTopWidth: 0,
          borderBottomRightRadius: 4,
        },
        // Couleur du cadre selon état
        scanFrameValid: { borderColor: colors.success },
        scanFrameInvalid: { borderColor: colors.num },
        scanFrameChecking: { borderColor: colors.primary },
        // Contrôles flottants en bas de la caméra
        controls: {
          position: "absolute",
          bottom: 12,
          left: 0,
          right: 0,
          flexDirection: "row",
          justifyContent: "center",
          gap: 10,
        },
        controlBtn: {
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 20,
          backgroundColor: "rgba(0,0,0,0.58)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.22)",
        },
        controlBtnActive: {
          backgroundColor: "rgba(255,255,255,0.18)",
          borderColor: "#ffffff",
        },
        controlBtnText: {
          color: "#ffffff",
          fontSize: 13,
          fontWeight: "700",
        },
        // Indication pinch (disparaît après le premier geste)
        pinchHint: {
          position: "absolute",
          top: 12,
          alignSelf: "center",
          paddingHorizontal: 12,
          paddingVertical: 5,
          borderRadius: 10,
          backgroundColor: "rgba(0,0,0,0.5)",
        },
        pinchHintText: {
          color: "rgba(255,255,255,0.85)",
          fontSize: 12,
          fontWeight: "600",
        },
        // Résultats
        resultCard: {
          marginHorizontal: 16,
          marginTop: 12,
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: 16,
          gap: 10,
          borderWidth: 1,
          borderColor: colors.border,
        },
        row: { flexDirection: "row", alignItems: "center", gap: 10 },
        hint: { fontSize: 14, color: colors.textMuted, textAlign: "center" },
        hintSmall: {
          fontSize: 12,
          color: colors.textMuted,
          textAlign: "center",
        },
        validTitle: {
          fontSize: 18,
          fontWeight: "800",
          color: colors.success,
          textAlign: "center",
        },
        duplicateTitle: { color: "#d97706" },
        invalidTitle: {
          fontSize: 18,
          fontWeight: "800",
          color: colors.num,
          textAlign: "center",
        },
        invalidText: {
          fontSize: 14,
          color: colors.textMuted,
          textAlign: "center",
          lineHeight: 20,
        },
        ticketNumber: {
          fontSize: 22,
          fontWeight: "800",
          color: colors.text,
          textAlign: "center",
          fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
        },
        meta: { fontSize: 13, color: colors.textMuted, textAlign: "center" },
        primaryBtn: {
          backgroundColor: colors.primary,
          borderRadius: radius.sm,
          paddingVertical: 14,
          alignItems: "center",
        },
        primaryBtnText: {
          color: colors.surface,
          fontSize: 16,
          fontWeight: "700",
        },
        secondaryBtn: {
          backgroundColor: colors.bg,
          borderRadius: radius.sm,
          paddingVertical: 12,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.border,
        },
        secondaryBtnText: {
          color: colors.text,
          fontSize: 15,
          fontWeight: "600",
        },
        linkBtn: { alignItems: "center", paddingVertical: 4 },
        linkBtnText: { fontSize: 13, color: colors.textMuted },
      }),
    [colors, radius],
  );

  // -------------------------------------------------------------------------
  // Rendu — web
  // -------------------------------------------------------------------------

  if (Platform.OS === "web") {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.title}>Scanner</Text>
        <Text style={styles.webMsg}>
          Le scan de billets est disponible sur l'application mobile (Android /
          iOS).
        </Text>
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // Rendu — permissions en cours de chargement
  // -------------------------------------------------------------------------

  if (!permission) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // Rendu — permission refusée
  // -------------------------------------------------------------------------

  if (!permission.granted) {
    return (
      <View
        style={[
          styles.root,
          styles.centered,
          { padding: 24, paddingTop: insets.top + 24 },
        ]}
      >
        <Text style={styles.title}>Scanner Billetterie</Text>
        <Text style={styles.permText}>
          Les QR codes Billetterie sont chiffrés : les autres apps ne peuvent
          pas lire leur contenu. Autorisez la caméra pour valider les billets.
        </Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => void requestPermission()}
        >
          <Text style={styles.primaryBtnText}>Autoriser la caméra</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // Couleur du cadre selon l'état
  // -------------------------------------------------------------------------

  const frameStateStyle =
    scanState.status === "valid"
      ? styles.scanFrameValid
      : scanState.status === "invalid"
        ? styles.scanFrameInvalid
        : scanState.status === "checking"
          ? styles.scanFrameChecking
          : null;

  // -------------------------------------------------------------------------
  // Rendu principal — caméra active dès l'entrée dans le menu
  // -------------------------------------------------------------------------

  return (
    <View style={styles.root}>
      {/* En-tête */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Scanner</Text>
        <Text style={styles.subtitle}>
          QR chiffré — lecture impossible hors Billetterie
        </Text>
      </View>

      {/* Zone caméra avec geste de pincement */}
      <GestureDetector gesture={pinchGesture}>
        <View style={styles.cameraWrap}>
          {/* Caméra — ouverte immédiatement, scan actif sauf si paused */}
          <CameraView
            style={styles.camera}
            facing="back"
            zoom={zoom}
            enableTorch={torchOn}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={paused ? undefined : handleBarcode}
          />

          {/* Masque semi-transparent + cadre de visée */}
          <View
            style={styles.overlay}
            // pointerEvents box-none : les touches passent au travers vers la caméra
            pointerEvents="box-none"
          >
            <View
              style={styles.overlayMask}
              pointerEvents="none"
            />
            <View style={styles.scanFrameWrap} pointerEvents="none">
              <View style={[styles.scanFrame, frameStateStyle]} />
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
          </View>

          {/* Indication "Pincez pour zoomer" — disparaît au premier geste */}
          {pinchHintVisible && (
            <View style={styles.pinchHint} pointerEvents="none">
              <Text style={styles.pinchHintText}>
                🤌 Pincez pour zoomer
              </Text>
            </View>
          )}

          {/* Bouton torche */}
          <View style={styles.controls} pointerEvents="box-none">
            <TouchableOpacity
              style={[styles.controlBtn, torchOn && styles.controlBtnActive]}
              onPress={() => setTorchOn((v) => !v)}
            >
              <Text style={styles.controlBtnText}>
                {torchOn ? "🔦 ON" : "🔦 Torche"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </GestureDetector>

      {/* Carte résultat */}
      <View style={[styles.resultCard, { marginBottom: insets.bottom + 12 }]}>
        {scanState.status === "idle" && (
          <>
            <Text style={styles.hint}>
              Placez le QR code du billet dans le cadre
            </Text>
            <Text style={styles.hintSmall}>
              Pincez l'écran pour zoomer sur un petit QR code
            </Text>
          </>
        )}

        {scanState.status === "checking" && (
          <View style={styles.row}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.hint}>Vérification de la signature…</Text>
          </View>
        )}

        {scanState.status === "invalid" && (
          <>
            <Text style={styles.invalidTitle}>Billet refusé</Text>
            <Text style={styles.invalidText}>{scanState.reason}</Text>
            <TouchableOpacity style={styles.secondaryBtn} onPress={resetScan}>
              <Text style={styles.secondaryBtnText}>Scanner à nouveau</Text>
            </TouchableOpacity>
          </>
        )}

        {scanState.status === "valid" && (
          <>
            <Text
              style={[
                styles.validTitle,
                scanState.duplicate && styles.duplicateTitle,
              ]}
            >
              {scanState.duplicate
                ? "⚠️ Billet déjà scanné"
                : "✅ Billet valide"}
            </Text>
            <Text style={styles.ticketNumber}>{scanState.ticket}</Text>
            <Text style={styles.meta}>Événement : {scanState.eventId}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={resetScan}>
              <Text style={styles.primaryBtnText}>
                Scanner un autre billet
              </Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={styles.linkBtn} onPress={confirmClearHistory}>
          <Text style={styles.linkBtnText}>Effacer l'historique des scans</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
