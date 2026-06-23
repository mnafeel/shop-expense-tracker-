import type { AppData, AppSettings, BillItem, Category, ItemBill, LabourEntry } from "./types";
import { createId } from "./ids";

export const UNCATEGORIZED_ID = "";

export const defaultSettings: AppSettings = {
  itemCategories: [],
  labourCategories: [],
};

export function getCategoryName(
  categoryId: string,
  categories: Category[]
): string {
  if (!categoryId) return "Uncategorized";
  return categories.find((c) => c.id === categoryId)?.name ?? "Uncategorized";
}

export interface CategoryTotalRow {
  categoryId: string;
  name: string;
  total: number;
}

export function computeItemCategoryTotals(data: AppData): CategoryTotalRow[] {
  const amounts = new Map<string, number>();
  for (const bill of data.itemBills) {
    for (const item of bill.items) {
      const id = item.categoryId || UNCATEGORIZED_ID;
      amounts.set(id, (amounts.get(id) || 0) + item.price);
    }
  }
  return mapToRows(amounts, data.settings.itemCategories);
}

export function computeLabourCategoryTotals(data: AppData): CategoryTotalRow[] {
  const amounts = new Map<string, number>();
  for (const entry of data.labour) {
    const id = entry.categoryId || UNCATEGORIZED_ID;
    amounts.set(id, (amounts.get(id) || 0) + entry.amount);
  }
  return mapToRows(amounts, data.settings.labourCategories);
}

function mapToRows(
  amounts: Map<string, number>,
  categories: Category[]
): CategoryTotalRow[] {
  const rows: CategoryTotalRow[] = [];
  const remaining = new Map(amounts);

  for (const cat of categories) {
    const total = remaining.get(cat.id) || 0;
    if (total > 0) {
      rows.push({ categoryId: cat.id, name: cat.name, total });
    }
    remaining.delete(cat.id);
  }

  let uncategorized = 0;
  remaining.forEach((v) => {
    uncategorized += v;
  });
  if (uncategorized > 0) {
    rows.push({
      categoryId: UNCATEGORIZED_ID,
      name: "Uncategorized",
      total: uncategorized,
    });
  }

  return rows;
}

export function matchesCategory(
  entryCategoryId: string,
  filterCategoryId: string
): boolean {
  const normalized = entryCategoryId || UNCATEGORIZED_ID;
  return normalized === filterCategoryId;
}

export function computeFilteredItemTotal(
  data: AppData,
  categoryId: string | null
): number {
  if (!categoryId) {
    return data.itemBills.reduce(
      (s, b) => s + b.items.reduce((t, i) => t + i.price, 0),
      0
    );
  }
  let total = 0;
  for (const bill of data.itemBills) {
    for (const item of bill.items) {
      if (matchesCategory(item.categoryId, categoryId)) {
        total += item.price;
      }
    }
  }
  return total;
}

export function computeFilteredLabourTotal(
  data: AppData,
  categoryId: string | null
): number {
  if (!categoryId) {
    return data.labour.reduce((s, l) => s + l.amount, 0);
  }
  return data.labour
    .filter((entry) => matchesCategory(entry.categoryId, categoryId))
    .reduce((s, l) => s + l.amount, 0);
}

export function filterBillItems(
  items: BillItem[],
  categoryId: string | null
): BillItem[] {
  if (!categoryId) return items;
  return items.filter((item) => matchesCategory(item.categoryId, categoryId));
}

export function getFilteredItemBills(
  data: AppData,
  categoryId: string | null
): ItemBill[] {
  if (!categoryId) return data.itemBills;
  return data.itemBills
    .map((bill) => ({
      ...bill,
      items: filterBillItems(bill.items, categoryId),
    }))
    .filter((bill) => bill.items.length > 0);
}

export function getFilteredLabour(
  data: AppData,
  categoryId: string | null
): LabourEntry[] {
  if (!categoryId) return data.labour;
  return data.labour.filter((entry) =>
    matchesCategory(entry.categoryId, categoryId)
  );
}

export function createCategory(name: string): Category {
  return {
    id: createId(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
  };
}

export function normalizeSettings(raw: unknown): AppSettings {
  if (!raw || typeof raw !== "object") return { ...defaultSettings };
  const s = raw as Record<string, unknown>;
  return {
    itemCategories: normalizeCategoryList(s.itemCategories),
    labourCategories: normalizeCategoryList(s.labourCategories),
  };
}

/** Keep categories from both devices when cloud data merges. */
export function mergeSettings(local: AppSettings, remote: unknown): AppSettings {
  const normalized = normalizeSettings(remote);
  return {
    itemCategories: mergeCategoryLists(
      local.itemCategories,
      normalized.itemCategories
    ),
    labourCategories: mergeCategoryLists(
      local.labourCategories,
      normalized.labourCategories
    ),
  };
}

function mergeCategoryLists(a: Category[], b: Category[]): Category[] {
  const byId = new Map<string, Category>();
  for (const c of a) byId.set(c.id, c);
  for (const c of b) byId.set(c.id, c);
  return Array.from(byId.values()).sort(
    (x, y) =>
      new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime()
  );
}

function normalizeCategoryList(raw: unknown): Category[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      const row = c as Record<string, unknown>;
      const name = String(row.name ?? "").trim();
      if (!name) return null;
      return {
        id: String(row.id ?? createId()),
        name,
        createdAt: String(row.createdAt ?? new Date().toISOString()),
      };
    })
    .filter((c): c is Category => c !== null);
}
