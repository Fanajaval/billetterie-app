import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  clampNormBox,
  defaultBoxes,
  duplicateBox,
  nudgeBox,
  resizeBox,
  type NormBox,
} from "../lib/boxes";
import { readImageSize, resolveImageUri } from "../lib/image";
import { DEFAULT_EVENT_ID } from "../lib/ticketAuth";
import { useAppTheme } from "../theme";
import { LoadingScreen } from "./LoadingScreen";
import { StepBar } from "./StepBar";

const TicketCanvas = lazy(() =>
  import("./TicketCanvas").then((m) => ({ default: m.TicketCanvas })),
);

export function TicketBuilder() {
  const insets = useSafeAreaInsets();
  const { colors, radius } = useAppTheme();
  const [step, setStep] = useState<0 | 1 | 2>(0);

  const [imgUri, setImgUri] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState({ w: 800, h: 400 });
  const [qrBoxes, setQrBoxes] = useState<NormBox[]>(() => defaultBoxes().qr);
  const [numBoxes, setNumBoxes] = useState<NormBox[]>(() => defaultBoxes().num);

  const [format, setFormat] = useState<"2x8" | "1x2">("2x8");
  const [pageCount, setPageCount] = useState("1");
  const [count, setCount] = useState("16");
  const [startNum, setStartNum] = useState("1");
  const [prefix, setPrefix] = useState("TKT-");
  const [padding, setPadding] = useState("4");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [picking, setPicking] = useState(false);
  const [progress, setProgress] = useState(0);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.bg },
        scroll: { paddingHorizontal: 16, gap: 16 },
        brand: { fontSize: 26, fontWeight: "800", color: colors.text },
        tagline: {
          fontSize: 14,
          color: colors.textMuted,
          marginTop: -8,
          marginBottom: 4,
        },
        card: {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: 16,
          gap: 12,
          borderWidth: 1,
          borderColor: colors.border,
        },
        cardTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
        cardDesc: { fontSize: 14, color: colors.textMuted, lineHeight: 21 },
        fieldRow: { flexDirection: "row", gap: 12 },
        fieldHalf: { flex: 1, gap: 6 },
        label: { fontSize: 13, fontWeight: "600", color: colors.text },
        input: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.sm,
          paddingHorizontal: 12,
          paddingVertical: 12,
          fontSize: 16,
          backgroundColor: colors.bg,
          color: colors.text,
        },
        sampleBox: {
          backgroundColor: colors.bg,
          borderRadius: radius.sm,
          paddingVertical: 12,
          paddingHorizontal: 12,
          borderWidth: 1,
          borderColor: colors.border,
        },
        sampleText: {
          fontSize: 16,
          fontWeight: "700",
          color: colors.text,
          fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
        },
        advancedToggle: {
          fontSize: 13,
          color: colors.primary,
          fontWeight: "600",
        },
        summary: {
          backgroundColor: colors.primaryLight,
          borderRadius: radius.sm,
          padding: 12,
        },
        summaryText: { fontSize: 13, color: colors.primary, fontWeight: "600" },
        primaryBtn: {
          backgroundColor: colors.primary,
          borderRadius: radius.sm,
          paddingVertical: 16,
          alignItems: "center",
        },
        generateBtn: {
          backgroundColor: colors.success,
          borderRadius: radius.sm,
          paddingVertical: 18,
          alignItems: "center",
        },
        generateBtnText: {
          color: colors.textOnPrimary,
          fontSize: 17,
          fontWeight: "700",
        },
        primaryBtnText: {
          color: colors.textOnPrimary,
          fontSize: 16,
          fontWeight: "700",
        },
        btnDisabled: { opacity: 0.6 },
        backBtn: { alignItems: "center", paddingVertical: 8 },
        backBtnText: { color: colors.textMuted, fontSize: 14 },
        linkBtn: { alignItems: "center", paddingVertical: 8 },
        linkBtnText: { color: colors.num, fontSize: 14, fontWeight: "500" },
        row: { flexDirection: "row", alignItems: "center", gap: 10 },
        pickerContainer: { gap: 8 },
        pickerOption: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.sm,
          paddingHorizontal: 12,
          paddingVertical: 10,
          backgroundColor: colors.bg,
        },
        pickerOptionSelected: {
          borderColor: colors.primary,
          backgroundColor: colors.primaryLight,
        },
        pickerOptionText: {
          fontSize: 13,
          color: colors.text,
          fontWeight: "500",
        },
        pickerOptionTextSelected: {
          color: colors.primary,
          fontWeight: "700",
        },
        inputDisabled: {
          opacity: 0.6,
        },
      }),
    [colors, radius],
  );

  // Calculate tickets per page based on format
  const ticketsPerPage = format === "2x8" ? 16 : 2;
  const pageCountNum = Math.max(1, parseInt(pageCount, 10) || 1);
  const countNum = ticketsPerPage * pageCountNum;
  
  const startNumVal = Math.max(0, parseInt(startNum, 10) || 0);
  const paddingNum = Math.max(0, parseInt(padding, 10) || 0);
  const sampleNumber = `${prefix}${String(startNumVal).padStart(paddingNum, "0")}`;
  const previewEnd = `${prefix}${String(startNumVal + countNum - 1).padStart(paddingNum, "0")}`;
  
  // Update count automatically when format or page count changes
  useEffect(() => {
    setCount(String(countNum));
  }, [format, pageCountNum]);

  const resetBoxes = () => {
    const d = defaultBoxes();
    setQrBoxes(d.qr);
    setNumBoxes(d.num);
  };

  const applyUri = async (rawUri: string, width?: number, height?: number) => {
    const uri = await resolveImageUri(rawUri);
    setImgUri(uri);
    resetBoxes();
    setStep(1);

    const setSize = (w: number, h: number) => setImgSize({ w, h });
    if (width && height) {
      setSize(width, height);
      return;
    }
    readImageSize(uri, setSize, () => setSize(800, 400));
  };

  useEffect(() => {
    if (Platform.OS !== "android") return;
    void import("expo-image-picker").then(({ getPendingResultAsync }) =>
      getPendingResultAsync().then((pending) => {
        if (!pending || !("canceled" in pending)) return;
        if (!pending.canceled && pending.assets?.[0]) {
          const a = pending.assets[0];
          void applyUri(a.uri, a.width, a.height);
        }
      }),
    );
  }, []);

  const pickImage = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const DocumentPicker = await import("expo-document-picker");
      const doc = await DocumentPicker.getDocumentAsync({
        type: ["image/png", "image/jpeg", "image/jpg", "image/webp"],
        copyToCacheDirectory: true,
      });
      if (!doc.canceled && doc.assets?.[0]) {
        await applyUri(doc.assets[0].uri);
        return;
      }
      if (doc.canceled) return;

      const ImagePicker = await import("expo-image-picker");
      if (Platform.OS === "ios") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission refusée", "Autorisez l'accès aux photos.", [
            { text: "Réglages", onPress: () => Linking.openSettings() },
            { text: "OK" },
          ]);
          return;
        }
      }
      const gal = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (!gal.canceled && gal.assets?.[0]) {
        const a = gal.assets[0];
        await applyUri(a.uri, a.width, a.height);
      }
    } catch {
      Alert.alert("Erreur", "Impossible d'importer l'image.");
    } finally {
      setPicking(false);
    }
  };

  const generate = async () => {
    if (!imgUri) return;
    setGenerating(true);
    setProgress(0);
    try {
      const { generateTicketsPdf } = await import("../lib/pdf");
      const { firstThumb } = await generateTicketsPdf({
        imgUri,
        imgW: imgSize.w,
        imgH: imgSize.h,
        qrBoxes,
        numBoxes,
        count: countNum,
        startNum: startNumVal,
        prefix,
        padding: paddingNum,
        eventId: DEFAULT_EVENT_ID,
        format,
        pageCount: pageCountNum,
        onProgress: setProgress,
      });
      const { addHistory } = await import("../lib/history");
      await addHistory({
        id: `${Date.now()}`,
        createdAt: Date.now(),
        prefix,
        padding: paddingNum,
        startNum: startNumVal,
        count: countNum,
        firstTicket: sampleNumber,
        lastTicket: previewEnd,
        thumbnail: firstThumb,
      });
      Alert.alert(
        "Terminé",
        `${countNum} billet(s) généré(s). Le PDF est prêt à être partagé.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur inconnue";
      Alert.alert("Erreur", `La génération a échoué. ${message}`);
    } finally {
      setGenerating(false);
    }
  };

  const nudgeQr = (index: number, dx: number, dy: number) =>
    setQrBoxes((arr) =>
      arr.map((b, i) => (i === index ? nudgeBox(b, dx, dy) : b)),
    );
  const nudgeNum = (index: number, dx: number, dy: number) =>
    setNumBoxes((arr) =>
      arr.map((b, i) => (i === index ? nudgeBox(b, dx, dy) : b)),
    );
  const resizeQr = (index: number, f: number) =>
    setQrBoxes((arr) => arr.map((b, i) => (i === index ? resizeBox(b, f) : b)));
  const resizeNum = (index: number, f: number) =>
    setNumBoxes((arr) =>
      arr.map((b, i) => (i === index ? resizeBox(b, f) : b)),
    );

  const addQrBox = () =>
    setQrBoxes((arr) => [
      ...arr,
      duplicateBox(arr[arr.length - 1] ?? defaultBoxes().qr[0]),
    ]);
  const addNumBox = () =>
    setNumBoxes((arr) => [
      ...arr,
      duplicateBox(arr[arr.length - 1] ?? defaultBoxes().num[0]),
    ]);
  const removeQrBox = (index: number) =>
    setQrBoxes((arr) =>
      arr.length <= 1 ? arr : arr.filter((_, i) => i !== index),
    );
  const removeNumBox = (index: number) =>
    setNumBoxes((arr) =>
      arr.length <= 1 ? arr : arr.filter((_, i) => i !== index),
    );

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 8, paddingBottom: 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.brand}>Billetterie</Text>
        <Text style={styles.tagline}>Générateur de billets</Text>

        <StepBar current={step} />

        {step === 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Étape 1 — Importer votre billet
            </Text>
            <Text style={styles.cardDesc}>
              Choisissez l'image vierge de votre billet (PNG ou JPG). Vous
              placerez ensuite le QR code et le numéro dessus.
            </Text>
            <TouchableOpacity
              style={[styles.primaryBtn, picking && styles.btnDisabled]}
              onPress={() => void pickImage()}
              disabled={picking}
            >
              {picking ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.primaryBtnText}>Choisir mon billet</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {step >= 1 && imgUri && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Étape 2 — Positionner</Text>
              <Text style={styles.cardDesc}>
                Glissez les zones QR et Numéro sur l'image. Appuyez sur + pour
                ajouter un autre emplacement identique. Zoomez avec +/− pour un
                réglage précis.
              </Text>
              <Suspense
                fallback={<LoadingScreen label="Chargement de l'éditeur…" />}
              >
                <TicketCanvas
                  imgUri={imgUri}
                  imgW={imgSize.w}
                  imgH={imgSize.h}
                  qrBoxes={qrBoxes}
                  numBoxes={numBoxes}
                  sampleNumber={sampleNumber}
                  longestNumber={previewEnd}
                  onUpdateQr={(i, b) =>
                    setQrBoxes((arr) =>
                      arr.map((x, idx) => (idx === i ? clampNormBox(b) : x)),
                    )
                  }
                  onUpdateNum={(i, b) =>
                    setNumBoxes((arr) =>
                      arr.map((x, idx) => (idx === i ? clampNormBox(b) : x)),
                    )
                  }
                  onNudgeQr={nudgeQr}
                  onNudgeNum={nudgeNum}
                  onResizeQr={resizeQr}
                  onResizeNum={resizeNum}
                  onAddQr={addQrBox}
                  onAddNum={addNumBox}
                  onRemoveQr={removeQrBox}
                  onRemoveNum={removeNumBox}
                  onReset={resetBoxes}
                />
              </Suspense>
            </View>

            {step === 1 && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => setStep(2)}
              >
                <Text style={styles.primaryBtnText}>
                  Continuer vers la génération →
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {step === 2 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Étape 3 — Générer</Text>

            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Format A4</Text>
                <View style={styles.pickerContainer}>
                  <Pressable
                    style={[styles.pickerOption, format === "2x8" && styles.pickerOptionSelected]}
                    onPress={() => setFormat("2x8")}
                  >
                    <Text style={[styles.pickerOptionText, format === "2x8" && styles.pickerOptionTextSelected]}>
                      2 colonnes × 8 lignes (16 billets/page)
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.pickerOption, format === "1x2" && styles.pickerOptionSelected]}
                    onPress={() => setFormat("1x2")}
                  >
                    <Text style={[styles.pickerOptionText, format === "1x2" && styles.pickerOptionTextSelected]}>
                      1 colonne × 2 lignes (2 billets/page)
                    </Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Nombre de pages</Text>
                <TextInput
                  style={styles.input}
                  value={pageCount}
                  onChangeText={setPageCount}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Nombre de billets</Text>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={count}
                  editable={false}
                  selectTextOnFocus={false}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>N° de départ</Text>
                <TextInput
                  style={styles.input}
                  value={startNum}
                  onChangeText={setStartNum}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Préfixe</Text>
                <TextInput
                  style={styles.input}
                  value={prefix}
                  onChangeText={setPrefix}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Exemple</Text>
                <View style={styles.sampleBox}>
                  <Text style={styles.sampleText}>{sampleNumber}</Text>
                </View>
              </View>
            </View>

            <Pressable onPress={() => setShowAdvanced((v) => !v)}>
              <Text style={styles.advancedToggle}>
                {showAdvanced ? "▲ Masquer options" : "▼ Plus d'options"}
              </Text>
            </Pressable>

            {showAdvanced && (
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Zéros (ex: 0001)</Text>
                <TextInput
                  style={styles.input}
                  value={padding}
                  onChangeText={setPadding}
                  keyboardType="number-pad"
                />
              </View>
            )}

            <View style={styles.summary}>
              <Text style={styles.summaryText}>
                {countNum} billet(s) : {sampleNumber} → {previewEnd}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.generateBtn, generating && styles.btnDisabled]}
              onPress={() => void generate()}
              disabled={generating}
            >
              {generating ? (
                <View style={styles.row}>
                  <ActivityIndicator color={colors.textOnPrimary} />
                  <Text style={styles.generateBtnText}>
                    Génération… {progress}%
                  </Text>
                </View>
              ) : (
                <Text style={styles.generateBtnText}>
                  Générer et partager le PDF
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
              <Text style={styles.backBtnText}>
                ← Modifier le positionnement
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {step > 0 && (
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => {
              Alert.alert(
                "Recommencer ?",
                "L'image et les positions seront effacées.",
                [
                  { text: "Annuler", style: "cancel" },
                  {
                    text: "Recommencer",
                    style: "destructive",
                    onPress: () => {
                      setImgUri(null);
                      resetBoxes();
                      setStep(0);
                    },
                  },
                ],
              );
            }}
          >
            <Text style={styles.linkBtnText}>Changer d'image</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
