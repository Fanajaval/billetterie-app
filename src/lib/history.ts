import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "./firebase";
import { collection, addDoc, getDocs, onSnapshot, query, orderBy, limit, deleteDoc, doc, writeBatch } from "firebase/firestore";

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
const COLLECTION_NAME = "history";

export async function getHistory(): Promise<HistoryEntry[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"), limit(MAX_ENTRIES));
    const querySnapshot = await getDocs(q);
    const history = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HistoryEntry));
    
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    return history;
  } catch (e) {
    console.error("Erreur getHistory:", e);
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  }
}

export async function addHistory(entry: HistoryEntry): Promise<void> {
  try {
    // Créer une copie sans la thumbnail pour Firebase (trop grosse pour Firestore)
    const { thumbnail, ...entryWithoutThumb } = entry;
    const docRef = await addDoc(collection(db, COLLECTION_NAME), entryWithoutThumb);
    entry.id = docRef.id;
  } catch (e) {
    console.error("Erreur addHistory:", e);
  }
  
  // Sauvegarder localement AVEC la thumbnail
  const history = [entry, ...(await getHistory())].slice(0, MAX_ENTRIES);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export async function clearHistory(): Promise<void> {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    const batch = writeBatch(db);
    querySnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  } catch (e) {
    console.error("Erreur clearHistory:", e);
  }
  
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export function subscribeToHistory(callback: (history: HistoryEntry[]) => void) {
  const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"), limit(MAX_ENTRIES));
  return onSnapshot(q, (querySnapshot) => {
    const history = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HistoryEntry));
    callback(history);
  });
}
