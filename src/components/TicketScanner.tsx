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

import { validateQrContent } from "../lib/ticketAuth";
import {
  clearScannedTickets,
  isTicketScanned,
  markTicketScanned,
} from "../lib/scannedTickets";
import { useAppTheme } from "../theme";

type ScanState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "valid"; ticket: string; eventId: string; duplicate: boolean }
  | { status: "invalid"; reason: string };

const SCAN_COOLDOWN_MS = 2500;

export function TicketScanner() {
  const insets = useSafeAreaInsets();
  const { colors, radius } = useAppTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>({ status: "idle" });
  const [paused, setPaused] = useState(false);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.bg },
        centered: { alignItems: "center", justifyContent: "center", gap: 16 },
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
        },
        scanFrame: {
          width: "72%",
          aspectRatio: 1,
          borderWidth: 3,
          borderColor: colors.surface,
          borderRadius: radius.md,
          backgroundColor: "transparent",
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

  const resetScan = useCallback(() => {
    setScanState({ status: "idle" });
    setPaused(false);
    lastScanRef.current = { code: "", at: 0 };
  }, []);

  const handleBarcode = useCallback(
    async ({ data }: { data: string }) => {
      if (paused || scanState.status === "checking") return;

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
    [paused, scanState.status],
  );

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

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Scanner</Text>
        <Text style={styles.subtitle}>
          QR chiffré — lecture impossible hors Billetterie
        </Text>
      </View>

      <View style={styles.cameraWrap}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={paused ? undefined : handleBarcode}
        />
        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
        </View>
      </View>

      <View style={[styles.resultCard, { marginBottom: insets.bottom + 12 }]}>
        {scanState.status === "idle" && (
          <Text style={styles.hint}>
            Placez le QR code du billet dans le cadre
          </Text>
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
              {scanState.duplicate ? "Billet déjà scanné" : "Billet valide ✓"}
            </Text>
            <Text style={styles.ticketNumber}>{scanState.ticket}</Text>
            <Text style={styles.meta}>Événement : {scanState.eventId}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={resetScan}>
              <Text style={styles.primaryBtnText}>Scanner un autre billet</Text>
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
