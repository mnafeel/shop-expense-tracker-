import type { AppData } from "./types";
import {
  computeDashboardTotals,
  downloadDashboardPdf,
  downloadFullCsv,
  downloadFullJson,
} from "./export";

interface ExportPanelProps {
  data: AppData;
  disabled?: boolean;
}

export function ExportPanel({ data, disabled }: ExportPanelProps) {
  const totals = computeDashboardTotals(data);
  const hasData = totals.billCount > 0 || totals.labourCount > 0;

  return (
    <section className="export-panel card" aria-label="Download reports">
      <div className="card-header">
        <h2>Download &amp; Reports</h2>
        <span className="badge export-badge">Full data</span>
      </div>
      <div className="card-body">
        <p className="export-desc">
          Export all items and labour with dashboard totals. PDF includes summary
          plus every bill and labour entry.
        </p>
        <div className="export-actions">
          <button
            type="button"
            className="btn btn-export btn-export-json"
            onClick={() => downloadFullJson(data)}
            disabled={disabled || !hasData}
            title={hasData ? "Download full JSON backup" : "Add data first"}
          >
            Download JSON
          </button>
          <button
            type="button"
            className="btn btn-export btn-export-csv"
            onClick={() => downloadFullCsv(data, totals)}
            disabled={disabled || !hasData}
            title={hasData ? "Download full CSV spreadsheet" : "Add data first"}
          >
            Download CSV
          </button>
          <button
            type="button"
            className="btn btn-export btn-export-pdf"
            onClick={() => downloadDashboardPdf(data, totals)}
            disabled={disabled || !hasData}
            title={
              hasData
                ? "Download PDF with dashboard and all details"
                : "Add data first"
            }
          >
            Download PDF
          </button>
        </div>
        {!hasData && (
          <p className="hint export-hint">
            Add at least one item bill or labour entry to download.
          </p>
        )}
      </div>
    </section>
  );
}
