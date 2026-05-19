import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { AppData } from "./types";
import {
  computeItemCategoryTotals,
  computeLabourCategoryTotals,
  getCategoryName,
} from "./categories";
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

  y = writeCategoryTotalsSection(
    doc,
    margin,
    y,
    "Items by category",
    computeItemCategoryTotals(data),
    totals.itemsTotal,
    [15, 118, 110]
  );
  y += 8;

  y = writeItemsSection(doc, margin, y, data);
  y += 12;

  if (y > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    y = 18;
  }

  y = writeCategoryTotalsSection(
    doc,
    margin,
    y,
    "Labour by category",
    computeLabourCategoryTotals(data),
    totals.labourTotal,
    [124, 58, 237]
  );
  y += 8;

  writeLabourSection(doc, margin, y, data);
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
  y = writeCategoryTotalsSection(
    doc,
    margin,
    y,
    "Category totals",
    computeItemCategoryTotals(data),
    itemsTotal,
    [15, 118, 110]
  );
  y += 8;
  writeItemsSection(doc, margin, y, data);
  addPageNumbers(doc);
  doc.save(`items-billing-${dateStamp()}.pdf`);
}

/** Category-wise totals only (items + labour + grand). */
export function downloadCategoryTotalsPdf(
  data: AppData,
  totals: DashboardTotals
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;

  let y = writeReportHeader(
    doc,
    margin,
    "Category Totals Report"
  );

  autoTable(doc, {
    startY: y + 4,
    margin: { left: margin, right: margin },
    head: [["Summary", "Amount"]],
    body: [
      ["Items total", rs(totals.itemsTotal)],
      ["Labour total", rs(totals.labourTotal)],
      ["Grand total", rs(totals.grandTotal)],
    ],
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42], fontSize: 10 },
    styles: { fontSize: 10, cellPadding: 2.5 },
    columnStyles: { 1: { halign: "right" } },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === 2) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  y = getLastTableY(doc) + 12;
  y = writeCategoryTotalsSection(
    doc,
    margin,
    y,
    "Items by category",
    computeItemCategoryTotals(data),
    totals.itemsTotal,
    [15, 118, 110]
  );
  y += 10;

  if (y > doc.internal.pageSize.getHeight() - 50) {
    doc.addPage();
    y = 18;
  }

  writeCategoryTotalsSection(
    doc,
    margin,
    y,
    "Labour by category",
    computeLabourCategoryTotals(data),
    totals.labourTotal,
    [124, 58, 237]
  );

  addPageNumbers(doc);
  doc.save(`category-totals-${dateStamp()}.pdf`);
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
  y = writeCategoryTotalsSection(
    doc,
    margin,
    y,
    "Category totals",
    computeLabourCategoryTotals(data),
    labourTotal,
    [124, 58, 237]
  );
  y += 8;
  writeLabourSection(doc, margin, y, data);
  addPageNumbers(doc);
  doc.save(`labour-billing-${dateStamp()}.pdf`);
}

function writeCategoryTotalsSection(
  doc: jsPDF,
  margin: number,
  y: number,
  title: string,
  rows: ReturnType<typeof computeItemCategoryTotals>,
  fullTotal: number,
  fillColor: [number, number, number]
): number {
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(title, margin, y);

  const body =
    rows.length > 0
      ? rows.map((r) => [r.name, rs(r.total)])
      : [["—", "No data"]];

  body.push(["Full total", rs(fullTotal)]);

  autoTable(doc, {
    startY: y + 4,
    margin: { left: margin, right: margin },
    head: [["Category", "Total"]],
    body,
    theme: "grid",
    headStyles: { fillColor, fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: { 1: { halign: "right" } },
    didParseCell: (data) => {
      if (
        data.section === "body" &&
        data.row.index === body.length - 1
      ) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  return getLastTableY(doc);
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
  data: AppData
): number {
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Items Billing (detail)", margin, y);

  if (data.itemBills.length === 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text("No items billing records.", margin, y + 8);
    return y + 14;
  }

  const itemRows: string[][] = [];
  for (const bill of data.itemBills) {
    const billTotalVal = billTotal(bill);
    const date = formatDateTime(bill.savedAt);
    bill.items.forEach((item, index) => {
      itemRows.push([
        bill.shopName,
        getCategoryName(item.categoryId, data.settings.itemCategories),
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
    head: [["Shop", "Category", "Date", "Item", "Price", "Bill total"]],
    body: itemRows,
    theme: "striped",
    headStyles: { fillColor: [15, 118, 110], fontSize: 8 },
    styles: { fontSize: 7, cellPadding: 2 },
    columnStyles: { 4: { halign: "right" }, 5: { halign: "right" } },
  });

  return getLastTableY(doc);
}

function writeLabourSection(
  doc: jsPDF,
  margin: number,
  y: number,
  data: AppData
): number {
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Labour Billing (detail)", margin, y);

  if (data.labour.length === 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text("No labour entries.", margin, y + 8);
    return y + 14;
  }

  autoTable(doc, {
    startY: y + 4,
    margin: { left: margin, right: margin },
    head: [["Category", "Description", "Date", "Amount"]],
    body: data.labour.map((entry) => [
      getCategoryName(entry.categoryId, data.settings.labourCategories),
      entry.description,
      formatDateTime(entry.addedAt),
      rs(entry.amount),
    ]),
    theme: "striped",
    headStyles: { fillColor: [124, 58, 237], fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 3: { halign: "right" } },
  });

  return getLastTableY(doc);
}
