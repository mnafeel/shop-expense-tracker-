import type { AppData, BillItem, ItemBill, LabourEntry } from "./types";
import { createId } from "./ids";
import { billTotal } from "./storage";
import { formatCurrency, formatDateTime } from "./utils";

const HEADER = "# Shop Expense Tracker Backup";

/** Human-readable plain text for GitHub (data/expenses.txt). */
export function dataToText(data: AppData): string {
  const lines: string[] = [
    HEADER,
    `Updated: ${new Date().toISOString()}`,
    "",
    "## Item bills",
    "",
  ];

  if (data.itemBills.length === 0) {
    lines.push("(none)", "");
  } else {
    for (const bill of data.itemBills) {
      lines.push(`[bill:${bill.id}]`);
      lines.push(`Shop: ${bill.shopName}`);
      lines.push(`Saved: ${formatDateTime(bill.savedAt)}`);
      lines.push(`Updated: ${formatDateTime(bill.updatedAt)}`);
      for (const item of bill.items) {
        lines.push(
          `  - ${item.itemName} | ${formatCurrency(item.price)} | item:${item.id}`
        );
      }
      lines.push(`  Total: ${formatCurrency(billTotal(bill))}`, "");
    }
  }

  lines.push("## Labour", "");

  if (data.labour.length === 0) {
    lines.push("(none)", "");
  } else {
    for (const entry of data.labour) {
      lines.push(`[labour:${entry.id}]`);
      lines.push(
        `${entry.description} | ${formatCurrency(entry.amount)} | ${formatDateTime(entry.addedAt)}`
      );
      lines.push("");
    }
  }

  const itemsTotal = data.itemBills.reduce((s, b) => s + billTotal(b), 0);
  const labourTotal = data.labour.reduce((s, l) => s + l.amount, 0);
  lines.push(
    "---",
    `Items total: ${formatCurrency(itemsTotal)}`,
    `Labour total: ${formatCurrency(labourTotal)}`,
    `Grand total: ${formatCurrency(itemsTotal + labourTotal)}`
  );

  return lines.join("\n");
}

export function textToData(text: string): AppData {
  const trimmed = text.trim();
  if (!trimmed) {
    return { itemBills: [], labour: [] };
  }

  // Legacy: file was JSON inside .txt or raw JSON from old backup
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as AppData;
      return {
        itemBills: parsed.itemBills ?? [],
        labour: parsed.labour ?? [],
      };
    } catch {
      /* fall through to line parser */
    }
  }

  const itemBills: ItemBill[] = [];
  const labour: LabourEntry[] = [];

  let currentBill: ItemBill | null = null;

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line === "---") continue;

    const billMatch = line.match(/^\[bill:([^\]]+)\]$/i);
    if (billMatch) {
      currentBill = {
        id: billMatch[1],
        shopName: "",
        savedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [],
      };
      itemBills.push(currentBill);
      continue;
    }

    const labourMatch = line.match(/^\[labour:([^\]]+)\]$/i);
    if (labourMatch) {
      currentBill = null;
      labour.push({
        id: labourMatch[1],
        description: "",
        amount: 0,
        addedAt: new Date().toISOString(),
      });
      continue;
    }

    if (line.startsWith("Shop:") && currentBill) {
      currentBill.shopName = line.slice(5).trim();
      continue;
    }

    if (line.startsWith("Saved:") && currentBill) {
      continue;
    }

    if (line.startsWith("Updated:") && currentBill) {
      continue;
    }

    const itemMatch = line.match(
      /^-\s+(.+?)\s+\|\s+[^|]+\|\s+item:([^\s]+)$/i
    );
    if (itemMatch && currentBill) {
      const priceMatch = line.match(/₹\s*([\d,]+(?:\.\d+)?)/);
      const price = priceMatch
        ? parseFloat(priceMatch[1].replace(/,/g, ""))
        : 0;
      const item: BillItem = {
        id: itemMatch[2],
        itemName: itemMatch[1].trim(),
        price: Number.isFinite(price) ? price : 0,
      };
      currentBill.items.push(item);
      continue;
    }

    if (labour.length > 0 && line.includes("|")) {
      const entry = labour[labour.length - 1];
      if (!entry.description) {
        const parts = line.split("|").map((p) => p.trim());
        entry.description = parts[0] ?? "";
        const amountMatch = (parts[1] ?? line).match(/₹\s*([\d,]+(?:\.\d+)?)/);
        entry.amount = amountMatch
          ? parseFloat(amountMatch[1].replace(/,/g, ""))
          : 0;
      }
    }
  }

  return {
    itemBills: itemBills.filter((b) => b.shopName || b.items.length > 0),
    labour: labour.filter((l) => l.description || l.amount > 0),
  };
}

/** Parse old JSON backup for migration. */
export function jsonToData(json: string): AppData {
  const parsed = JSON.parse(json) as AppData;
  return {
    itemBills: parsed.itemBills ?? [],
    labour: parsed.labour ?? [],
  };
}

export function ensureIds(data: AppData): AppData {
  return {
    itemBills: data.itemBills.map((b) => ({
      ...b,
      id: b.id || createId(),
      items: b.items.map((i) => ({
        ...i,
        id: i.id || createId(),
      })),
    })),
    labour: data.labour.map((l) => ({
      ...l,
      id: l.id || createId(),
    })),
  };
}
