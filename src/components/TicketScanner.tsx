import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  clamp,
} from "react-native-reanimated";

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

// Délai minimum entre deux scans du même QR (évite les doubles validations)
const SCAN_COOLDOWN_MS = 1500;

// Zoom : 0 = grand-angle, 1 = zoom max. On plafonne à 0.5 (au-delà l'image
// devient trop floue sur la plupart des appareils)
const ZOOM_MIN = 0;
const ZOOM_MAX = 0.5;

// Composant Camera animé pour injecter le zoom via Reanimated sans re-render
const AnimatedCameraView = Animated.createAnimatedComponent(CameraView);

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function TicketScanner() {
  const insets = useSafeAreaInsets();
  const { colors, radius } = useAppTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>({ status: "idle" });
  const [paused, setPaused] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const lastScanRef = useRef<{ code: string; at: number }>({
    code: "",
    at: 0,
  });

  // -------------------------------------------------------------------------
  // Zoom par pincement (Reanimated + Gesture Handler)
  // -------------------------------------------------------------------------
  const zoomBase = useSharedValue(ZOOM_MIN); // valeur au début du geste
  const zoom = useSharedValue(ZOOM_MIN); // valeur courante transmise à la caméra

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      // mémorise le zoom au moment où l'utilisateur commence à pincer
      zoomBase.value = zoom.value;
    })
    .onUpdate((e) => {
      // scale > 1 = zoom avant ; scale < 1 = zoom arrière
      // On mappe : delta de scale → delta de zoom (sensibilité ×0.3)
      const next = zoomBase.value + (e.scale - 1) * 0.3;
      zoom.value = clamp(next, ZOOM_MIN, ZOOM_MAX);
    });

  // Props animées : injectées directement dans le composant natif sans
  // passer par le thread JS → zéro lag
  const animatedProps = useAnimatedProps(() => ({
    zoom: zoom.value,
  }));

  // -------------------------------------------------------------------------
  // Scanner natif (MLKit / DataScannerViewController)
  // -------------------------------------------------------------------------
  // Sur Android (MLKit) et iOS 16+ (DataScannerViewController), expo-camera
  // propose un scanner natif avec highlight QR et pinch-to-zoom intégré.
  // C'est le même moteur que les apps professionnelles de scan.
  const [useNativeScanner] = useState(
    () => CameraView.isModernBarcodeScannerAvailable,
  );

  // Abonnement au scanner natif
  useEffect(() => {
    if (!useNativeScanner) return;
    const sub = CameraView.onModernBarcodeScanned(({ data }) => {
      void handleBarcodeData(data);
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useNativeScanner, paused]);

  const launchNativeScanner = useCallback(async () => {
    try {
      await CameraView.launchScanner({
        barcodeTypes: ["qr"],
        isPinchToZoomEnabled: true,   // pinch-to-zoom natif
        isGuidanceEnabled: true,       // guide visuel "Ralentissez…"
        isHighlightingEnabled: true,   // surbrillance du QR détecté
      });
    } catch {
      // launchScanner rejeté si l'utilisateur ferme la modal avant le scan
    }
  }, []);

  // -------------------------------------------------------------------------
  // Logique de validation commune
  // -------------------------------------------------------------------------
  const handleBarcodeData = useCallback(
    async (data: string) => {
      if (paused) return;

      const now = Date.now();
      if (
        lastScanRef.current.code === data &&
        now - lastScanRef.current.at < SCAN_COOLDOWN_MS
      ) {
        return;
      }
      lastScanRef.current = { code: data, at: now };

      // Ferme le scanner natif dès qu'un code est détecté
      if (useNativeScanner) {
        await CameraView.dismissScanner();
      }

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
    [paused, useNativeScanner],
  );

  const handleBarcode = useCallback(
    ({ data }: BarcodeScanningResult) => {
      void handleBarcodeData(data);
    },
    [handleBarcodeData],
  );

  const resetScan = useCallback(() => {
    setScanState({ status: "idle" });
    setPaused(false);
    lastScanRef.current = { code: "", at: 0 };
  }, []);

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
        overlay: {
          ...StyleSheet.absoluteFillObject,
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        },
        overlayMask: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.45)",
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
        scanFrameValid: { borderColor: colors.success },
        scanFrameInvalid: { borderColor: colors.num },
        scanFrameChecking: { borderColor: colors.primary },
        // Barre de contrôles flottante
        controls: {
          position: "absolute",
          bottom: 14,
          left: 0,
          right: 0,
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: 10,
        },
        controlBtn: {
          paddingHorizontal: 16,
          paddingVertical: 9,
          borderRadius: 20,
          backgroundColor: "rgba(0,0,0,0.6)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.25)",
        },
        controlBtnActive: {
          backgroundColor: "rgba(255,255,255,0.2)",
          borderColor: "#ffffff",
        },
        controlBtnText: {
          color: "#ffffff",
          fontSize: 13,
          fontWeight: "700",
        },
        zoomHint: {
          position: "absolute",
          top: 14,
          alignSelf: "center",
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 12,
          backgroundColor: "rgba(0,0,0,0.5)",
        },
        zoomHintText: {
          color: "#ffffff",
          fontSize: 12,
          fontWeight: "600",
        },
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
        meta: {
          fontSize: 13,
          color: colors.textMuted,
          textAlign: "center",
        },
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
        nativeScannerBtn: {
          backgroundColor: colors.primary,
          borderRadius: radius.sm,
          paddingVertical: 16,
          alignItems: "center",
          marginHorizontal: 16,
          marginTop: 12,
        },
        nativeScannerBtnText: {
          color: colors.surface,
          fontSize: 16,
          fontWeight: "700",
        },
      }),
    [colors, radius],
  );

  // -------------------------------------------------------------------------
  // Rendu — cas plateformes / permissions
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

  if (!permission) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

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

  // Couleur du cadre selon état
  const frameStateStyle =
    scanState.status === "valid"
      ? styles.scanFrameValid
      : scanState.status === "invalid"
        ? styles.scanFrameInvalid
        : scanState.status === "checking"
          ? styles.scanFrameChecking
          : null;

  const confirmClearHistory = () => {
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
  };

  // -------------------------------------------------------------------------
  // Rendu — scanner natif disponible (Android MLKit + iOS 16+)
  // -------------------------------------------------------------------------
  if (useNativeScanner) {
    return (
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.title}>Scanner</Text>
          <Text style={styles.subtitle}>
            QR chiffré — lecture impossible hors Billetterie
          </Text>
        </View>

        {/* Bouton d'ouverture du scanner natif (plein écran, MLKit) */}
        {!paused && (
          <TouchableOpacity
            style={styles.nativeScannerBtn}
            onPress={() => void launchNativeScanner()}
          >
            <Text style={styles.nativeScannerBtnText}>
              📷 Scanner un billet
            </Text>
          </TouchableOpacity>
        )}

        <View style={[styles.resultCard, { marginBottom: insets.bottom + 12 }]}>
          {scanState.status === "idle" && (
            <>
              <Text style={styles.hint}>
                Appuyez sur le bouton pour scanner
              </Text>
              <Text style={styles.hintSmall}>
                Le scanner détecte les QR codes même en petite taille.
                Pincez pour zoomer.
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

          <TouchableOpacity
            style={styles.linkBtn}
            onPress={confirmClearHistory}
          >
            <Text style={styles.linkBtnText}>
              Effacer l'historique des scans
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // Rendu — scanner custom avec pinch-to-zoom Reanimated (fallback)
  // Utilisé sur iOS < 16 ou si le scanner natif n'est pas disponible.
  // -------------------------------------------------------------------------
  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Scanner</Text>
        <Text style={styles.subtitle}>
          QR chiffré — lecture impossible hors Billetterie
        </Text>
      </View>

      {/* Zone caméra avec gesture de pincement */}
      <GestureDetector gesture={pinchGesture}>
        <View style={styles.cameraWrap}>
          <AnimatedCameraView
            style={styles.camera}
            facing="back"
            // autofocus "off" = autofocus continu (le nom est contre-intuitif
            // dans expo-camera : "off" désactive le verrou, pas l'AF)
            autofocus="off"
            enableTorch={torchOn}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={paused ? undefined : handleBarcode}
            animatedProps={animatedProps}
          />

          {/* Masque + cadre */}
          <View style={styles.overlay}>
            <View style={styles.overlayMask} />
            <View style={styles.scanFrameWrap}>
              <View style={[styles.scanFrame, frameStateStyle]} />
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
          </View>

          {/* Indication zoom */}
          <View style={styles.zoomHint} pointerEvents="none">
            <Text style={styles.zoomHintText}>
              Pincez pour zoomer
            </Text>
          </View>

          {/* Bouton torche */}
          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.controlBtn, torchOn && styles.controlBtnActive]}
              onPress={() => setTorchOn((v) => !v)}
            >
              <Text style={styles.controlBtnText}>
                {torchOn ? "🔦 Torche ON" : "🔦 Torche"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </GestureDetector>

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
          <Text style={styles.linkBtnText}>
            Effacer l'historique des scans
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
