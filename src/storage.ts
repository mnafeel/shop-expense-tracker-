import type { AppData, BillItem, ItemBill } from "./types";
import { createId } from "./ids";

const STORAGE_KEY = "shop-expense-tracker";

export const defaultData: AppData = {
  itemBills: [],
  labour: [],
};

function normalizeBillItem(raw: Record<string, unknown>): BillItem {
  return {
    id: String(raw.id ?? createId()),
    itemName: String(raw.itemName ?? raw.name ?? ""),
    price: Number(raw.price) || 0,
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

function migrateLegacy(parsed: Record<string, unknown>): AppData {
  const labour = (parsed.labour as AppData["labour"]) ?? [];
  const rawBills = parsed.itemBills ?? parsed.bills;

  if (Array.isArray(rawBills)) {
    return {
      itemBills: rawBills.map((b) =>
        normalizeItemBill(b as Record<string, unknown>)
      ),
      labour,
    };
  }

  return { itemBills: [], labour: [] };
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultData };
    return migrateLegacy(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return { ...defaultData };
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function billTotal(bill: ItemBill): number {
  return bill.items.reduce((s, i) => s + i.price, 0);
}
