import type { AppData, BillItem, ItemBill } from "./types";
import { defaultSettings, normalizeSettings } from "./categories";
import { createId } from "./ids";

const LEGACY_STORAGE_KEY = "shop-expense-tracker";

export const defaultData: AppData = {
  itemBills: [],
  labour: [],
  settings: { ...defaultSettings },
};

function normalizeBillItem(raw: Record<string, unknown>): BillItem {
  return {
    id: String(raw.id ?? createId()),
    itemName: String(raw.itemName ?? raw.name ?? ""),
    price: Number(raw.price) || 0,
    categoryId: String(raw.categoryId ?? ""),
  };
}

function normalizeItemBill(raw: Record<string, unknown>): ItemBill {
  const savedAt = String(raw.savedAt ?? raw.addedAt ?? new Date().toISOString());
  let shopName = String(raw.shopName ?? "");

  let items: BillItem[] = [];
  if (Array.isArray(raw.items)) {
    items = raw.items.map((i) => {
      const item = normalizeBillItem(i as Record<string, unknown>);
      const row = i as Record<string, unknown>;
      if (!shopName && row.shopName) shopName = String(row.shopName);
      return item;
    });
  } else if (Array.isArray(raw.products)) {
    items = (raw.products as Record<string, unknown>[]).map((p) =>
      normalizeBillItem({ ...p, itemName: p.name })
    );
  }

  if (!shopName && items.length > 0) {
    const first = raw.items as Record<string, unknown>[] | undefined;
    if (first?.[0]?.shopName) shopName = String(first[0].shopName);
  }

  return {
    id: String(raw.id ?? createId()),
    shopName,
    savedAt,
    updatedAt: String(raw.updatedAt ?? savedAt),
    items,
  };
}

function normalizeLabour(raw: Record<string, unknown>): AppData["labour"][0] {
  return {
    id: String(raw.id ?? createId()),
    description: String(raw.description ?? ""),
    amount: Number(raw.amount) || 0,
    addedAt: String(raw.addedAt ?? new Date().toISOString()),
    categoryId: String(raw.categoryId ?? ""),
  };
}

function migrateLegacy(parsed: Record<string, unknown>): AppData {
  const labour = Array.isArray(parsed.labour)
    ? (parsed.labour as Record<string, unknown>[]).map(normalizeLabour)
    : [];
  const rawBills = parsed.itemBills ?? parsed.bills;

  let itemBills: ItemBill[] = [];
  if (Array.isArray(rawBills)) {
    itemBills = rawBills.map((b) =>
      normalizeItemBill(b as Record<string, unknown>)
    );
  }

  return {
    itemBills,
    labour,
    settings: normalizeSettings(parsed.settings),
  };
}

/** One-time read of browser local backup; removes the key after read. */
export function consumeLegacyLocalBackup(): AppData | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return migrateLegacy(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return null;
  }
}

export function billTotal(bill: ItemBill): number {
  return bill.items.reduce((s, i) => s + i.price, 0);
}

export function normalizeAppData(raw: Partial<AppData>): AppData {
  return {
    itemBills: (raw.itemBills ?? []).map((b) =>
      normalizeItemBill(b as unknown as Record<string, unknown>)
    ),
    labour: (raw.labour ?? []).map((l) =>
      normalizeLabour(l as unknown as Record<string, unknown>)
    ),
    settings: normalizeSettings(raw.settings),
  };
}
