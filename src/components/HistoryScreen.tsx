import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { clearHistory, getHistory, type HistoryEntry } from "../lib/history";
import { getScannedTickets, type ScannedEntry } from "../lib/scannedTickets";
import { useAppTheme } from "../theme";

type TicketStatus = { ticket: string; scanned: boolean; scannedAt?: number };
type HistoryTab = "overview" | "generations" | "scans";

type GenerationSummary = {
  entry: HistoryEntry;
  tickets: TicketStatus[];
  scannedCount: number;
  remainingCount: number;
  completion: number;
};

function formatDate(value: number): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatRange(entry: HistoryEntry): string {
  return `${entry.firstTicket} → ${entry.lastTicket}`;
}

function extractTicketNumbers(entry: HistoryEntry): string[] {
  return Array.from({ length: entry.count }, (_, index) => {
    const current = entry.startNum + index;
    return `${entry.prefix}${String(current).padStart(entry.padding, "0")}`;
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function toDateInputValue(value: number): string {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string, mode: "start" | "end"): number | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;

  const [year, month, day] = trimmed.split("-").map(Number);
  const date =
    mode === "start"
      ? new Date(year, month - 1, day, 0, 0, 0, 0)
      : new Date(year, month - 1, day, 23, 59, 59, 999);

  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
}

function toBoundaryDate(value: string, mode: "start" | "end"): Date {
  const timestamp = parseDateInput(value, mode);
  return timestamp === null ? new Date() : new Date(timestamp);
}

function isWithinDateRange(
  value: number,
  startDate: string,
  endDate: string,
): boolean {
  const start = parseDateInput(startDate, "start");
  const end = parseDateInput(endDate, "end");
  if (start === null || end === null) return true;
  return value >= start && value <= end;
}

export function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { colors, radius } = useAppTheme();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [scannedEntries, setScannedEntries] = useState<ScannedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pickerMode, setPickerMode] = useState<"start" | "end" | null>(null);
  const [selectedGeneration, setSelectedGeneration] =
    useState<GenerationSummary | null>(null);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<HistoryTab>("overview");

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.bg },
        scroll: { paddingHorizontal: 16, gap: 16 },
        heroCard: {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: 18,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 14,
        },
        title: { fontSize: 28, fontWeight: "800", color: colors.text },
        subtitle: { fontSize: 14, color: colors.textMuted, lineHeight: 21 },
        quickStatsRow: { flexDirection: "row", gap: 10 },
        quickStatChip: {
          flex: 1,
          backgroundColor: colors.surfaceSoft,
          borderRadius: radius.md,
          paddingVertical: 12,
          paddingHorizontal: 8,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.border,
          gap: 4,
        },
        quickStatValue: {
          fontSize: 18,
          fontWeight: "800",
          color: colors.primary,
        },
        quickStatLabel: { fontSize: 12, color: colors.textMuted },
        panel: {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 12,
        },
        panelTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
        panelSubtitle: {
          fontSize: 14,
          color: colors.textMuted,
          lineHeight: 20,
        },
        searchInput: {
          backgroundColor: colors.bg,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: colors.text,
        },
        dateRangeRow: { flexDirection: "row", gap: 12 },
        dateField: { flex: 1, gap: 6 },
        dateLabel: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },
        datePickerBtn: {
          backgroundColor: colors.bg,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 14,
          paddingVertical: 12,
        },
        datePickerValue: {
          fontSize: 14,
          color: colors.text,
          fontWeight: "600",
        },
        actionsRow: { flexDirection: "row", gap: 10 },
        secondaryActionBtn: {
          backgroundColor: colors.bg,
          borderRadius: radius.sm,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderWidth: 1,
          borderColor: colors.border,
        },
        secondaryActionBtnText: { color: colors.text, fontWeight: "700" },
        actionBtn: {
          flex: 1,
          backgroundColor: colors.primary,
          borderRadius: radius.sm,
          alignItems: "center",
          paddingVertical: 12,
        },
        actionBtnDisabled: { opacity: 0.6 },
        actionBtnText: { color: colors.textOnPrimary, fontWeight: "700" },
        segmentedTabs: {
          flexDirection: "row",
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: 6,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 6,
        },
        segmentBtn: {
          flex: 1,
          borderRadius: radius.md,
          paddingVertical: 10,
          alignItems: "center",
        },
        segmentBtnActive: { backgroundColor: colors.primaryLight },
        segmentText: {
          color: colors.textMuted,
          fontWeight: "600",
          fontSize: 13,
        },
        segmentTextActive: { color: colors.primary, fontWeight: "800" },
        statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
        statCard: {
          width: "48%",
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 8,
        },
        summaryLabel: { fontSize: 13, color: colors.textMuted },
        summaryValue: {
          fontSize: 28,
          fontWeight: "800",
          color: colors.primary,
        },
        compactStatValue: {
          fontSize: 18,
          fontWeight: "800",
          color: colors.text,
        },
        scannedValue: { color: colors.success },
        remainingValue: { color: colors.num },
        lastBatchTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
        lastBatchMeta: {
          fontSize: 14,
          color: colors.textMuted,
          lineHeight: 20,
        },
        clearBtn: { alignSelf: "flex-start", paddingVertical: 6 },
        clearBtnText: { color: colors.num, fontWeight: "700", fontSize: 13 },
        clearBtnTextDisabled: { color: colors.textMuted },
        searchResultsList: { gap: 10 },
        searchResultRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          backgroundColor: colors.bg,
          borderRadius: radius.md,
          padding: 12,
          borderWidth: 1,
          borderColor: colors.border,
        },
        searchResultBody: { flex: 1, gap: 4 },
        searchTicket: { fontSize: 17, fontWeight: "800", color: colors.text },
        searchResultSubtext: {
          fontSize: 13,
          color: colors.textMuted,
          lineHeight: 18,
        },
        sectionHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 2,
        },
        sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
        sectionCount: {
          minWidth: 28,
          textAlign: "center",
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: colors.primaryLight,
          color: colors.primary,
          fontWeight: "800",
        },
        emptyCard: {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: 20,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          gap: 10,
        },
        emptyTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
        emptyText: {
          fontSize: 14,
          color: colors.textMuted,
          textAlign: "center",
          lineHeight: 20,
        },
        card: {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: 14,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 12,
        },
        cardTop: { flexDirection: "row", gap: 12, alignItems: "center" },
        thumb: {
          width: 72,
          height: 72,
          borderRadius: radius.md,
          backgroundColor: colors.bg,
        },
        thumbPlaceholder: {
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: colors.border,
        },
        thumbPlaceholderText: { color: colors.textMuted, fontWeight: "700" },
        cardBody: { flex: 1, gap: 4 },
        cardTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
        cardDate: { fontSize: 13, color: colors.textMuted },
        cardMeta: { fontSize: 14, color: colors.primary, fontWeight: "700" },
        progressBlock: { gap: 8 },
        progressLabels: { flexDirection: "row", alignItems: "center", gap: 10 },
        progressText: { fontSize: 13, color: colors.textMuted, flex: 1 },
        progressPercent: {
          fontSize: 13,
          color: colors.primary,
          fontWeight: "800",
        },
        progressTrack: {
          height: 8,
          borderRadius: 999,
          backgroundColor: colors.border,
          overflow: "hidden",
        },
        progressFill: {
          height: "100%",
          backgroundColor: colors.success,
          borderRadius: 999,
        },
        scanRow: {
          flexDirection: "row",
          gap: 12,
          alignItems: "center",
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: 14,
          borderWidth: 1,
          borderColor: colors.border,
        },
        scanBadge: {
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: colors.success,
          alignItems: "center",
          justifyContent: "center",
        },
        scanBadgeText: { color: colors.textOnPrimary, fontWeight: "800" },
        scanBody: { flex: 1, gap: 3 },
        scanTicket: { fontSize: 15, fontWeight: "800", color: colors.text },
        scanMeta: { fontSize: 13, color: colors.textMuted },
        modalBackdrop: {
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "flex-end",
        },
        modalCard: {
          maxHeight: "82%",
          backgroundColor: colors.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: 16,
          paddingHorizontal: 16,
          gap: 12,
        },
        modalHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
        modalHeaderText: { flex: 1, gap: 4 },
        modalTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
        modalSubtitle: { fontSize: 14, color: colors.textMuted },
        closeBtn: { paddingHorizontal: 12, paddingVertical: 8 },
        closeBtnText: { color: colors.primary, fontWeight: "700" },
        modalScroll: { gap: 10, paddingBottom: 8 },
        ticketRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        ticketRowTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
        ticketRowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
        ticketStatus: {
          borderRadius: 999,
          paddingHorizontal: 12,
          paddingVertical: 7,
        },
        ticketStatusDone: { backgroundColor: colors.successBg },
        ticketStatusPending: { backgroundColor: colors.numBg },
        ticketStatusText: { fontWeight: "700" },
        ticketStatusTextDone: { color: colors.success },
        ticketStatusTextPending: { color: colors.num },
      }),
    [colors, radius],
  );

  const loadHistory = useCallback(async () => {
    const [items, scanned] = await Promise.all([
      getHistory(),
      getScannedTickets(),
    ]);
    setEntries(items);
    setScannedEntries(scanned);

    const sortedAsc = [...items].sort((a, b) => a.createdAt - b.createdAt);
    const firstGeneration = sortedAsc[0]?.createdAt ?? Date.now();
    const today = Date.now();

    setStartDate((current) => current || toDateInputValue(firstGeneration));
    setEndDate((current) => current || toDateInputValue(today));
  }, []);

  useEffect(() => {
    void loadHistory().finally(() => setLoading(false));
  }, [loadHistory]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadHistory();
      setSearch("");
      setSelectedGeneration(null);
      setActiveTab("overview");

      const sortedAsc = [...entries].sort((a, b) => a.createdAt - b.createdAt);
      const firstGeneration = sortedAsc[0]?.createdAt ?? Date.now();
      const today = Date.now();
      setStartDate(toDateInputValue(firstGeneration));
      setEndDate(toDateInputValue(today));
    } finally {
      setRefreshing(false);
    }
  }, [entries, loadHistory]);

  const scannedMap = useMemo(() => {
    return new Map(scannedEntries.map((entry) => [entry.ticket, entry]));
  }, [scannedEntries]);

  const generationSummaries = useMemo<GenerationSummary[]>(() => {
    return entries.map((entry) => {
      const tickets = extractTicketNumbers(entry).map((ticket) => {
        const scanned = scannedMap.get(ticket);
        return {
          ticket,
          scanned: Boolean(scanned),
          scannedAt: scanned?.scannedAt,
        };
      });
      const scannedCount = tickets.filter((ticket) => ticket.scanned).length;
      const remainingCount = Math.max(entry.count - scannedCount, 0);
      const completion =
        entry.count > 0 ? Math.round((scannedCount / entry.count) * 100) : 0;

      return {
        entry,
        tickets,
        scannedCount,
        remainingCount,
        completion,
      };
    });
  }, [entries, scannedMap]);

  const filteredGenerations = useMemo(() => {
    return generationSummaries.filter((generation) =>
      isWithinDateRange(generation.entry.createdAt, startDate, endDate),
    );
  }, [endDate, generationSummaries, startDate]);

  const filteredScanHistory = useMemo(() => {
    return scannedEntries.filter((entry) => {
      if (!isWithinDateRange(entry.scannedAt, startDate, endDate)) return false;
      const normalizedSearch = search.trim().toLowerCase();
      if (!normalizedSearch) return true;
      return entry.ticket.toLowerCase().includes(normalizedSearch);
    });
  }, [endDate, scannedEntries, search, startDate]);

  const searchResults = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) {
      return [] as Array<{
        ticket: string;
        scanned: boolean;
        scannedAt?: number;
        generation: HistoryEntry;
      }>;
    }

    const results: Array<{
      ticket: string;
      scanned: boolean;
      scannedAt?: number;
      generation: HistoryEntry;
    }> = [];

    for (const generation of generationSummaries) {
      for (const ticket of generation.tickets) {
        if (ticket.ticket.toLowerCase().includes(value)) {
          results.push({
            ticket: ticket.ticket,
            scanned: ticket.scanned,
            scannedAt: ticket.scannedAt,
            generation: generation.entry,
          });
        }
      }
    }

    return results;
  }, [generationSummaries, search]);

  const totalGenerated = filteredGenerations.reduce(
    (sum, generation) => sum + generation.entry.count,
    0,
  );
  const totalScanned = filteredGenerations.reduce(
    (sum, generation) => sum + generation.scannedCount,
    0,
  );
  const totalRemaining = Math.max(totalGenerated - totalScanned, 0);
  const latestGeneration = filteredGenerations[0]?.entry ?? entries[0];

  const handleDateChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === "android") {
        setPickerMode(null);
      }

      if (event.type === "dismissed" || !selectedDate || !pickerMode) return;

      const nextValue = toDateInputValue(selectedDate.getTime());
      if (pickerMode === "start") {
        setStartDate(nextValue);
        return;
      }
      setEndDate(nextValue);
    },
    [pickerMode],
  );

  const confirmClear = useCallback(() => {
    Alert.alert(
      "Effacer l'historique ?",
      "Toutes les générations enregistrées seront supprimées.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Effacer",
          style: "destructive",
          onPress: () => {
            void clearHistory().then(loadHistory);
          },
        },
      ],
    );
  }, [loadHistory]);

  const exportDashboard = useCallback(async () => {
    if (!filteredGenerations.length) {
      Alert.alert(
        "Export impossible",
        "Aucune donnée à exporter pour cette période.",
      );
      return;
    }

    setExporting(true);
    try {
      const rowsHtml = filteredGenerations
        .map(
          (generation) => `
              <tr>
                <td>${escapeHtml(formatDate(generation.entry.createdAt))}</td>
                <td>${escapeHtml(generation.entry.firstTicket)}</td>
                <td>${escapeHtml(generation.entry.lastTicket)}</td>
                <td>${generation.entry.count}</td>
                <td>${generation.scannedCount}</td>
                <td>${generation.remainingCount}</td>
                <td>${generation.completion}%</td>
              </tr>
            `,
        )
        .join("");

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
    h1 { margin-bottom: 4px; }
    p { color: #64748b; }
    .stats { display: flex; gap: 12px; margin: 20px 0; }
    .stat { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; min-width: 120px; }
    .value { font-size: 24px; font-weight: bold; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
    th { background: #f8fafc; }
  </style>
</head>
<body>
  <h1>Tableau de bord Billetterie</h1>
  <p>Période : ${escapeHtml(startDate)} → ${escapeHtml(endDate)} • Recherche billet : ${escapeHtml(search || "aucune")}</p>
  <div class="stats">
    <div class="stat"><div>Générations</div><div class="value">${filteredGenerations.length}</div></div>
    <div class="stat"><div>Billets générés</div><div class="value">${totalGenerated}</div></div>
    <div class="stat"><div>Billets scannés</div><div class="value">${totalScanned}</div></div>
    <div class="stat"><div>Restants</div><div class="value">${totalRemaining}</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Premier billet</th>
        <th>Dernier billet</th>
        <th>Générés</th>
        <th>Scannés</th>
        <th>Restants</th>
        <th>Progression</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;

      const { uri } = await Print.printToFileAsync({ html });
      const first = filteredGenerations[0]?.entry.firstTicket ?? "debut";
      const last =
        filteredGenerations[filteredGenerations.length - 1]?.entry.lastTicket ??
        "fin";
      const filename = `tableau_bord_billets_${first}-${last}.pdf`;
      const dest = new FileSystem.File(FileSystem.Paths.cache, filename);
      if (dest.exists) {
        dest.delete();
      }
      new FileSystem.File(uri).move(dest);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dest.uri, {
          mimeType: "application/pdf",
          dialogTitle: "Exporter le tableau de bord",
          UTI: "com.adobe.pdf",
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur inconnue";
      Alert.alert("Export impossible", message);
    } finally {
      setExporting(false);
    }
  }, [
    endDate,
    filteredGenerations,
    search,
    startDate,
    totalGenerated,
    totalRemaining,
    totalScanned,
  ]);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
          />
        }
      >
        <View style={styles.heroCard}>
          <Text style={styles.title}>Historique</Text>
          <Text style={styles.subtitle}>
            Retrouvez facilement vos générations, vos billets validés et vos
            recherches récentes.
          </Text>

          <View style={styles.quickStatsRow}>
            <View style={styles.quickStatChip}>
              <Text style={styles.quickStatValue}>
                {filteredGenerations.length}
              </Text>
              <Text style={styles.quickStatLabel}>Générations</Text>
            </View>
            <View style={styles.quickStatChip}>
              <Text style={styles.quickStatValue}>{totalScanned}</Text>
              <Text style={styles.quickStatLabel}>Scannés</Text>
            </View>
            <View style={styles.quickStatChip}>
              <Text style={styles.quickStatValue}>{totalRemaining}</Text>
              <Text style={styles.quickStatLabel}>Restants</Text>
            </View>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Recherche et période</Text>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher un billet précis"
            placeholderTextColor={colors.textMuted}
          />

          <View style={styles.dateRangeRow}>
            <View style={styles.dateField}>
              <Text style={styles.dateLabel}>Date début</Text>
              <TouchableOpacity
                style={styles.datePickerBtn}
                onPress={() => setPickerMode("start")}
              >
                <Text style={styles.datePickerValue}>{startDate}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.dateField}>
              <Text style={styles.dateLabel}>Date fin</Text>
              <TouchableOpacity
                style={styles.datePickerBtn}
                onPress={() => setPickerMode("end")}
              >
                <Text style={styles.datePickerValue}>{endDate}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[
                styles.secondaryActionBtn,
                refreshing && styles.actionBtnDisabled,
              ]}
              onPress={() => void handleRefresh()}
              disabled={refreshing}
            >
              <Text style={styles.secondaryActionBtnText}>
                {refreshing ? "Réinitialisation…" : "Rafraîchir"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, exporting && styles.actionBtnDisabled]}
              onPress={() => void exportDashboard()}
              disabled={exporting}
            >
              <Text style={styles.actionBtnText}>Exporter PDF</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.segmentedTabs}>
          {[
            ["overview", "Vue d'ensemble"],
            ["generations", "Générations"],
            ["scans", "Scans"],
          ].map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.segmentBtn,
                activeTab === key && styles.segmentBtnActive,
              ]}
              onPress={() => setActiveTab(key as HistoryTab)}
            >
              <Text
                style={[
                  styles.segmentText,
                  activeTab === key && styles.segmentTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {search.trim() ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Résultats de recherche</Text>
            <Text style={styles.panelSubtitle}>
              {searchResults.length} billet(s) correspondent à "{search.trim()}
              ".
            </Text>

            {searchResults.length > 0 ? (
              <View style={styles.searchResultsList}>
                {searchResults.slice(0, 8).map((result) => (
                  <View
                    key={`${result.ticket}-${result.generation.id}`}
                    style={styles.searchResultRow}
                  >
                    <View style={styles.searchResultBody}>
                      <Text style={styles.searchTicket}>{result.ticket}</Text>
                      <Text style={styles.searchResultSubtext}>
                        Génération : {formatRange(result.generation)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.ticketStatus,
                        result.scanned
                          ? styles.ticketStatusDone
                          : styles.ticketStatusPending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.ticketStatusText,
                          result.scanned
                            ? styles.ticketStatusTextDone
                            : styles.ticketStatusTextPending,
                        ]}
                      >
                        {result.scanned ? "Scanné" : "En attente"}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Aucun billet trouvé</Text>
                <Text style={styles.emptyText}>
                  Essayez une autre partie du numéro du billet recherché.
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {activeTab === "overview" && (
          <>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.summaryLabel}>Billets générés</Text>
                <Text style={styles.summaryValue}>{totalGenerated}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.summaryLabel}>Billets scannés</Text>
                <Text style={[styles.summaryValue, styles.scannedValue]}>
                  {totalScanned}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.summaryLabel}>Restants estimés</Text>
                <Text style={[styles.summaryValue, styles.remainingValue]}>
                  {totalRemaining}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.summaryLabel}>Dernière génération</Text>
                <Text style={styles.compactStatValue}>
                  {latestGeneration ? latestGeneration.firstTicket : "—"}
                </Text>
              </View>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Dernière génération</Text>
              <Text style={styles.lastBatchTitle}>
                {latestGeneration
                  ? formatRange(latestGeneration)
                  : "Aucune génération"}
              </Text>
              <Text style={styles.lastBatchMeta}>
                {latestGeneration
                  ? `${latestGeneration.count} billet(s) • ${formatDate(latestGeneration.createdAt)}`
                  : "Générez des billets pour alimenter cet historique."}
              </Text>
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={confirmClear}
                disabled={!entries.length}
              >
                <Text
                  style={[
                    styles.clearBtnText,
                    !entries.length && styles.clearBtnTextDisabled,
                  ]}
                >
                  Effacer l'historique
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {activeTab === "generations" && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Générations</Text>
              <Text style={styles.sectionCount}>
                {filteredGenerations.length}
              </Text>
            </View>

            {loading ? (
              <View style={styles.emptyCard}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.emptyText}>
                  Chargement de l'historique…
                </Text>
              </View>
            ) : filteredGenerations.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Aucune génération trouvée</Text>
                <Text style={styles.emptyText}>
                  Modifiez la période ou générez un nouveau lot de billets.
                </Text>
              </View>
            ) : (
              filteredGenerations.map((generation) => (
                <TouchableOpacity
                  key={generation.entry.id}
                  style={styles.card}
                  activeOpacity={0.9}
                  onPress={() => setSelectedGeneration(generation)}
                >
                  <View style={styles.cardTop}>
                    {generation.entry.thumbnail ? (
                      <Image
                        source={{ uri: generation.entry.thumbnail }}
                        style={styles.thumb}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.thumb, styles.thumbPlaceholder]}>
                        <Text style={styles.thumbPlaceholderText}>PDF</Text>
                      </View>
                    )}

                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle}>
                        {formatRange(generation.entry)}
                      </Text>
                      <Text style={styles.cardDate}>
                        {formatDate(generation.entry.createdAt)}
                      </Text>
                      <Text style={styles.cardMeta}>
                        {generation.entry.count} billet(s)
                      </Text>
                    </View>
                  </View>

                  <View style={styles.progressBlock}>
                    <View style={styles.progressLabels}>
                      <Text style={styles.progressText}>
                        Scannés : {generation.scannedCount}
                      </Text>
                      <Text style={styles.progressText}>
                        Restants : {generation.remainingCount}
                      </Text>
                      <Text style={styles.progressPercent}>
                        {generation.completion}%
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${generation.completion}%` },
                        ]}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {activeTab === "scans" && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Historique des scans</Text>
              <Text style={styles.sectionCount}>
                {filteredScanHistory.length}
              </Text>
            </View>

            {filteredScanHistory.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Aucun scan trouvé</Text>
                <Text style={styles.emptyText}>
                  Les billets déjà validés apparaîtront ici avec leur heure de
                  scan.
                </Text>
              </View>
            ) : (
              filteredScanHistory.slice(0, 50).map((entry) => (
                <View
                  key={`${entry.ticket}-${entry.scannedAt}`}
                  style={styles.scanRow}
                >
                  <View style={styles.scanBadge}>
                    <Text style={styles.scanBadgeText}>✓</Text>
                  </View>
                  <View style={styles.scanBody}>
                    <Text style={styles.scanTicket}>{entry.ticket}</Text>
                    <Text style={styles.scanMeta}>
                      Scanné le {formatDate(entry.scannedAt)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {pickerMode ? (
        <DateTimePicker
          value={toBoundaryDate(
            pickerMode === "start" ? startDate : endDate,
            pickerMode,
          )}
          mode="date"
          display={Platform.OS === "android" ? "calendar" : "default"}
          onChange={handleDateChange}
          maximumDate={
            pickerMode === "start" ? toBoundaryDate(endDate, "end") : undefined
          }
          minimumDate={
            pickerMode === "end"
              ? toBoundaryDate(startDate, "start")
              : undefined
          }
        />
      ) : null}

      <Modal
        visible={Boolean(selectedGeneration)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedGeneration(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[styles.modalCard, { paddingBottom: insets.bottom + 16 }]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>
                  {selectedGeneration
                    ? formatRange(selectedGeneration.entry)
                    : "Détail de la génération"}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {selectedGeneration
                    ? `${selectedGeneration.entry.count} billet(s)`
                    : ""}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setSelectedGeneration(null)}
              >
                <Text style={styles.closeBtnText}>Fermer</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              {selectedGeneration?.tickets.map((ticket) => (
                <View key={ticket.ticket} style={styles.ticketRow}>
                  <View>
                    <Text style={styles.ticketRowTitle}>{ticket.ticket}</Text>
                    <Text style={styles.ticketRowMeta}>
                      {ticket.scanned && ticket.scannedAt
                        ? `Scanné le ${formatDate(ticket.scannedAt)}`
                        : "Non scanné"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.ticketStatus,
                      ticket.scanned
                        ? styles.ticketStatusDone
                        : styles.ticketStatusPending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.ticketStatusText,
                        ticket.scanned
                          ? styles.ticketStatusTextDone
                          : styles.ticketStatusTextPending,
                      ]}
                    >
                      {ticket.scanned ? "Scanné" : "En attente"}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
