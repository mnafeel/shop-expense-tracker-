import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { AppData } from "./types";
import { billTotal } from "./storage";
import { formatDateTime } from "./utils";

export interface DashboardTotals {
  itemsTotal: number;
  labourTotal: number;
  grandTotal: number;
  billCount: number;
  labourCount: number;
  itemLineCount: number;
}

function dateStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function rs(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function computeDashboardTotals(data: AppData): DashboardTotals {
  const itemsTotal = data.itemBills.reduce((s, b) => s + billTotal(b), 0);
  const labourTotal = data.labour.reduce((s, l) => s + l.amount, 0);
  const itemLineCount = data.itemBills.reduce((s, b) => s + b.items.length, 0);

  return {
    itemsTotal,
    labourTotal,
    grandTotal: itemsTotal + labourTotal,
    billCount: data.itemBills.length,
    labourCount: data.labour.length,
    itemLineCount,
  };
}

/** Full backup as JSON (items + labour). */
export function downloadFullJson(data: AppData) {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: "Shop Expense Tracker",
    itemBills: data.itemBills,
    labour: data.labour,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  downloadBlob(blob, `shop-expense-full-${dateStamp()}.json`);
}

/** Full data as CSV for Excel / Sheets. */
export function downloadFullCsv(data: AppData, totals: DashboardTotals) {
  const lines: string[] = [];
  const stamp = new Date().toLocaleString("en-IN");

  lines.push("Shop Expense Tracker - Full Export");
  lines.push(`Generated,${escapeCsv(stamp)}`);
  lines.push("");
  lines.push("DASHBOARD SUMMARY");
  lines.push("Metric,Value");
  lines.push(`Items Total,${totals.itemsTotal}`);
  lines.push(`Labour Total,${totals.labourTotal}`);
  lines.push(`Grand Total,${totals.grandTotal}`);
  lines.push(`Shop Bills,${totals.billCount}`);
  lines.push(`Item Lines,${totals.itemLineCount}`);
  lines.push(`Labour Entries,${totals.labourCount}`);
  lines.push("");
  lines.push("ITEMS BILLING");
  lines.push("Shop,Date,Item,Price (INR),Bill Total (INR)");

  for (const bill of data.itemBills) {
    const total = billTotal(bill);
    const date = formatDateTime(bill.savedAt);
    bill.items.forEach((item, index) => {
      lines.push(
        [
          escapeCsv(bill.shopName),
          escapeCsv(index === 0 ? date : ""),
          escapeCsv(item.itemName),
          item.price,
          index === 0 ? total : "",
        ].join(",")
      );
    });
  }

  lines.push("");
  lines.push("LABOUR BILLING");
  lines.push("Description,Date,Amount (INR)");

  for (const entry of data.labour) {
    lines.push(
      [
        escapeCsv(entry.description),
        escapeCsv(formatDateTime(entry.addedAt)),
        entry.amount,
      ].join(",")
    );
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `shop-expense-full-${dateStamp()}.csv`);
}

/** Dashboard summary + all item & labour rows as PDF. */
export function downloadDashboardPdf(data: AppData, totals: DashboardTotals) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 18;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Shop Expense Tracker", margin, y);

  y += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Report generated: ${new Date().toLocaleString("en-IN")}`, margin, y);

  y += 10;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Dashboard Summary", margin, y);

  y += 4;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Metric", "Value"]],
    body: [
      ["Items total", rs(totals.itemsTotal)],
      ["Labour total", rs(totals.labourTotal)],
      ["Grand total", rs(totals.grandTotal)],
      ["Shop bills", String(totals.billCount)],
      ["Item lines", String(totals.itemLineCount)],
      ["Labour entries", String(totals.labourCount)],
    ],
    theme: "grid",
    headStyles: { fillColor: [15, 118, 110], fontSize: 10 },
    styles: { fontSize: 10, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { halign: "right" },
    },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY + 12;

  if (data.itemBills.length > 0) {
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Items Billing (Full)", margin, y);
    y += 4;

    const itemRows: string[][] = [];
    for (const bill of data.itemBills) {
      const billTotalVal = billTotal(bill);
      const date = formatDateTime(bill.savedAt);
      bill.items.forEach((item, index) => {
        itemRows.push([
          bill.shopName,
          index === 0 ? date : "",
          item.itemName,
          rs(item.price),
          index === 0 ? rs(billTotalVal) : "",
        ]);
      });
    }

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Shop", "Date", "Item", "Price", "Bill total"]],
      body: itemRows,
      theme: "striped",
      headStyles: { fillColor: [15, 118, 110], fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        3: { halign: "right" },
        4: { halign: "right" },
      },
    });

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 12;
  } else {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text("No items billing records.", margin, y + 4);
    y += 14;
  }

  if (y > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    y = 18;
  }

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Labour Billing (Full)", margin, y);
  y += 4;

  if (data.labour.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Description", "Date", "Amount"]],
      body: data.labour.map((entry) => [
        entry.description,
        formatDateTime(entry.addedAt),
        rs(entry.amount),
      ]),
      theme: "striped",
      headStyles: { fillColor: [124, 58, 237], fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        2: { halign: "right" },
      },
    });
  } else {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text("No labour entries.", margin, y + 4);
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
  }

  doc.save(`shop-expense-dashboard-${dateStamp()}.pdf`);
}
