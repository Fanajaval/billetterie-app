import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "./firebase";
import { collection, addDoc, getDocs, onSnapshot, query, orderBy, limit, where, writeBatch } from "firebase/firestore";

const STORAGE_KEY = "billetterie_scanned_tickets";
const COLLECTION_NAME = "scannedTickets";
const MAX_ENTRIES = 500;

export type ScannedEntry = {
  id?: string;
  ticket: string;
  eventId: string;
  scannedAt: number;
};

export async function getScannedTickets(): Promise<ScannedEntry[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy("scannedAt", "desc"), limit(MAX_ENTRIES));
    const querySnapshot = await getDocs(q);
    const tickets = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScannedEntry));
    
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
    return tickets;
  } catch (e) {
    console.error("Erreur getScannedTickets:", e);
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ScannedEntry[]) : [];
  }
}

export async function isTicketScanned(ticket: string): Promise<boolean> {
  try {
    const q = query(collection(db, COLLECTION_NAME), where("ticket", "==", ticket));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (e) {
    console.error("Erreur isTicketScanned:", e);
    const list = await getScannedTickets();
    return list.some((e) => e.ticket === ticket);
  }
}

export async function markTicketScanned(ticket: string, eventId: string): Promise<void> {
  if (await isTicketScanned(ticket)) return;
  
  const entry: ScannedEntry = {
    ticket,
    eventId,
    scannedAt: Date.now(),
  };
  
  try {
    await addDoc(collection(db, COLLECTION_NAME), entry);
  } catch (e) {
    console.error("Erreur markTicketScanned:", e);
  }
  
  const list = await getScannedTickets();
  const next: ScannedEntry[] = [entry, ...list].slice(0, MAX_ENTRIES);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export async function clearScannedTickets(): Promise<void> {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    const batch = writeBatch(db);
    querySnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  } catch (e) {
    console.error("Erreur clearScannedTickets:", e);
  }
  
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export function subscribeToScannedTickets(callback: (tickets: ScannedEntry[]) => void) {
  const q = query(collection(db, COLLECTION_NAME), orderBy("scannedAt", "desc"), limit(MAX_ENTRIES));
  return onSnapshot(q, (querySnapshot) => {
    const tickets = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScannedEntry));
    callback(tickets);
  });
}
