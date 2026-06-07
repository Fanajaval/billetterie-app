import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "billetterie_scanned_tickets";

export type ScannedEntry = {
  ticket: string;
  eventId: string;
  scannedAt: number;
};

export async function getScannedTickets(): Promise<ScannedEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ScannedEntry[]) : [];
  } catch {
    return [];
  }
}

export async function isTicketScanned(ticket: string): Promise<boolean> {
  const list = await getScannedTickets();
  return list.some((e) => e.ticket === ticket);
}

export async function markTicketScanned(ticket: string, eventId: string): Promise<void> {
  const list = await getScannedTickets();
  if (list.some((e) => e.ticket === ticket)) return;
  const next: ScannedEntry[] = [
    { ticket, eventId, scannedAt: Date.now() },
    ...list,
  ].slice(0, 500);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export async function clearScannedTickets(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
