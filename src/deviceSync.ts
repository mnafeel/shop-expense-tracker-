import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import type { AppData } from "./types";
import { normalizeAppData } from "./storage";
import { getFirestoreDb, isCloudSyncAvailable } from "./firebase";

const SYNC_CODE_KEY = "shop-expense-sync-code";

export interface CloudPayload extends AppData {
  updatedAt: number;
}

export function getSyncCode(): string | null {
  const code = localStorage.getItem(SYNC_CODE_KEY);
  return code?.trim() ? code.trim().toUpperCase() : null;
}

export function saveSyncCode(code: string): void {
  localStorage.setItem(SYNC_CODE_KEY, code.trim().toUpperCase());
}

export function clearSyncCode(): void {
  localStorage.removeItem(SYNC_CODE_KEY);
}

export function createSyncCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function docRef(code: string) {
  const db = getFirestoreDb();
  if (!db) throw new Error("Cloud sync not available");
  return doc(db, "sync", code);
}

export function subscribeCloudData(
  code: string,
  onUpdate: (payload: CloudPayload) => void,
  onError?: () => void
): () => void {
  if (!isCloudSyncAvailable()) return () => {};

  return onSnapshot(
    docRef(code),
    (snap) => {
      if (!snap.exists()) return;
      const raw = snap.data() as CloudPayload;
      onUpdate({
        ...normalizeAppData({
          itemBills: raw.itemBills ?? [],
          labour: raw.labour ?? [],
          settings: raw.settings,
        }),
        updatedAt: raw.updatedAt ?? 0,
      });
    },
    () => onError?.()
  );
}

export async function pushCloudData(
  code: string,
  data: AppData
): Promise<void> {
  if (!isCloudSyncAvailable()) {
    throw new Error("Firebase database not configured");
  }

  const payload: CloudPayload = {
    itemBills: data.itemBills,
    labour: data.labour,
    settings: data.settings,
    updatedAt: Date.now(),
  };

  try {
    await setDoc(docRef(code), payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Firestore write failed";
    if (msg.includes("permission") || msg.includes("PERMISSION_DENIED")) {
      throw new Error(
        "Firestore rules blocked save. Publish firestore.rules in Firebase Console."
      );
    }
    throw new Error(msg);
  }
}

export async function fetchCloudData(
  code: string
): Promise<CloudPayload | null> {
  if (!isCloudSyncAvailable()) return null;

  const snap = await getDoc(docRef(code));
  if (!snap.exists()) return null;
  const raw = snap.data() as CloudPayload;
  return {
    ...normalizeAppData({
      itemBills: raw.itemBills ?? [],
      labour: raw.labour ?? [],
      settings: raw.settings,
    }),
    updatedAt: raw.updatedAt ?? 0,
  };
}
