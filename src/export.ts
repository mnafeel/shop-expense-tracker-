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

function getLastTableY(doc: jsPDF): number {
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY;
}

function addPageNumbers(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
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

/** Full dashboard PDF (items + labour + totals). */
export function downloadDashboardPdf(data: AppData, totals: DashboardTotals) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;
  let y = writeReportHeader(doc, margin, "Shop Expense Tracker — Full Report");

  y = writeDashboardSummaryTable(doc, margin, y, totals) + 12;

  y = writeItemsSection(doc, margin, y, data.itemBills);
  y += 12;

  if (y > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    y = 18;
  }

  writeLabourSection(doc, margin, y, data.labour);
  addPageNumbers(doc);
  doc.save(`shop-expense-full-report-${dateStamp()}.pdf`);
}

/** Items billing only PDF. */
export function downloadItemsPdf(data: AppData, itemsTotal: number) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;
  const billCount = data.itemBills.length;
  const lineCount = data.itemBills.reduce((s, b) => s + b.items.length, 0);

  let y = writeReportHeader(doc, margin, "Items Billing Report");

  autoTable(doc, {
    startY: y + 4,
    margin: { left: margin, right: margin },
    head: [["Summary", "Value"]],
    body: [
      ["Items total", rs(itemsTotal)],
      ["Shop bills", String(billCount)],
      ["Item lines", String(lineCount)],
    ],
    theme: "grid",
    headStyles: { fillColor: [15, 118, 110], fontSize: 10 },
    styles: { fontSize: 10, cellPadding: 2.5 },
    columnStyles: { 1: { halign: "right" } },
  });

  y = getLastTableY(doc) + 12;
  writeItemsSection(doc, margin, y, data.itemBills);
  addPageNumbers(doc);
  doc.save(`items-billing-${dateStamp()}.pdf`);
}

/** Labour billing only PDF. */
export function downloadLabourPdf(data: AppData, labourTotal: number) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;

  let y = writeReportHeader(doc, margin, "Labour Billing Report");

  autoTable(doc, {
    startY: y + 4,
    margin: { left: margin, right: margin },
    head: [["Summary", "Value"]],
    body: [
      ["Labour total", rs(labourTotal)],
      ["Entries", String(data.labour.length)],
    ],
    theme: "grid",
    headStyles: { fillColor: [124, 58, 237], fontSize: 10 },
    styles: { fontSize: 10, cellPadding: 2.5 },
    columnStyles: { 1: { halign: "right" } },
  });

  y = getLastTableY(doc) + 12;
  writeLabourSection(doc, margin, y, data.labour);
  addPageNumbers(doc);
  doc.save(`labour-billing-${dateStamp()}.pdf`);
}

function writeReportHeader(doc: jsPDF, margin: number, title: string): number {
  let y = 18;
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(title, margin, y);

  y += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, margin, y);
  doc.setTextColor(0, 0, 0);
  return y;
}

function writeDashboardSummaryTable(
  doc: jsPDF,
  margin: number,
  y: number,
  totals: DashboardTotals
): number {
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Dashboard Summary", margin, y + 10);

  autoTable(doc, {
    startY: y + 14,
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
    columnStyles: { 0: { cellWidth: 70 }, 1: { halign: "right" } },
  });

  return getLastTableY(doc);
}

function writeItemsSection(
  doc: jsPDF,
  margin: number,
  y: number,
  itemBills: AppData["itemBills"]
): number {
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Items Billing", margin, y);

  if (itemBills.length === 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text("No items billing records.", margin, y + 8);
    return y + 14;
  }

  const itemRows: string[][] = [];
  for (const bill of itemBills) {
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
    startY: y + 4,
    margin: { left: margin, right: margin },
    head: [["Shop", "Date", "Item", "Price", "Bill total"]],
    body: itemRows,
    theme: "striped",
    headStyles: { fillColor: [15, 118, 110], fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 3: { halign: "right" }, 4: { halign: "right" } },
  });

  return getLastTableY(doc);
}

function writeLabourSection(
  doc: jsPDF,
  margin: number,
  y: number,
  labour: AppData["labour"]
): number {
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Labour Billing", margin, y);

  if (labour.length === 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text("No labour entries.", margin, y + 8);
    return y + 14;
  }

  autoTable(doc, {
    startY: y + 4,
    margin: { left: margin, right: margin },
    head: [["Description", "Date", "Amount"]],
    body: labour.map((entry) => [
      entry.description,
      formatDateTime(entry.addedAt),
      rs(entry.amount),
    ]),
    theme: "striped",
    headStyles: { fillColor: [124, 58, 237], fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 2: { halign: "right" } },
  });

  return getLastTableY(doc);
}
