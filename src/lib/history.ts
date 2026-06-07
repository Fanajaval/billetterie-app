import AsyncStorage from "@react-native-async-storage/async-storage";

export type HistoryEntry = {
  id: string;
  createdAt: number;
  prefix: string;
  padding: number;
  startNum: number;
  count: number;
  firstTicket: string;
  lastTicket: string;
  thumbnail?: string;
};

const STORAGE_KEY = "billetterie_history";
const MAX_ENTRIES = 50;

export async function getHistory(): Promise<HistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export async function addHistory(entry: HistoryEntry): Promise<void> {
  const history = [entry, ...(await getHistory())].slice(0, MAX_ENTRIES);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
