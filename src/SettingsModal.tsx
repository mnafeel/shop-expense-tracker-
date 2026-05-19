import { useMemo, useState } from "react";
import type { AppData, AppSettings, Category } from "./types";
import { createCategory, computeItemCategoryTotals, computeLabourCategoryTotals } from "./categories";
import { CategoryTotalsBlock } from "./CategoryTotalsBlock";
import {
  computeDashboardTotals,
  downloadCategoryTotalsPdf,
  downloadDashboardPdf,
  downloadItemsPdf,
  downloadLabourPdf,
} from "./export";
import { billTotal } from "./storage";
import { formatCurrency, formatDateTime } from "./utils";
import { PdfDownloadButton } from "./PdfDownloadButton";

export function SettingsFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="settings-fab"
      onClick={onClick}
      aria-label="Open settings"
      title="Settings — categories, totals & PDF"
    >
      <SettingsIcon />
    </button>
  );
}

export function SettingsModal({
  settings,
  data,
  onClose,
  onChange,
}: {
  settings: AppSettings;
  data: AppData;
  onClose: () => void;
  onChange: (settings: AppSettings) => void;
}) {
  const [itemName, setItemName] = useState("");
  const [labourName, setLabourName] = useState("");

  const itemsTotal = useMemo(
    () => data.itemBills.reduce((s, b) => s + billTotal(b), 0),
    [data.itemBills]
  );
  const labourTotal = useMemo(
    () => data.labour.reduce((s, l) => s + l.amount, 0),
    [data.labour]
  );
  const grandTotal = itemsTotal + labourTotal;
  const hasAnyData = data.itemBills.length > 0 || data.labour.length > 0;
  const dashboardTotals = useMemo(() => computeDashboardTotals(data), [data]);
  const itemCategoryTotals = useMemo(
    () => computeItemCategoryTotals(data),
    [data]
  );
  const labourCategoryTotals = useMemo(
    () => computeLabourCategoryTotals(data),
    [data]
  );

  const addItemCategory = () => {
    const name = itemName.trim();
    if (!name) return;
    if (
      settings.itemCategories.some(
        (c) => c.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      return;
    }
    onChange({
      ...settings,
      itemCategories: [...settings.itemCategories, createCategory(name)],
    });
    setItemName("");
  };

  const addLabourCategory = () => {
    const name = labourName.trim();
    if (!name) return;
    if (
      settings.labourCategories.some(
        (c) => c.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      return;
    }
    onChange({
      ...settings,
      labourCategories: [...settings.labourCategories, createCategory(name)],
    });
    setLabourName("");
  };

  const removeItemCategory = (id: string) => {
    onChange({
      ...settings,
      itemCategories: settings.itemCategories.filter((c) => c.id !== id),
    });
  };

  const removeLabourCategory = (id: string) => {
    onChange({
      ...settings,
      labourCategories: settings.labourCategories.filter((c) => c.id !== id),
    });
  };

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <section
        className="settings-modal card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="settings-title"
      >
        <div className="card-header">
          <h2 id="settings-title">Settings</h2>
          <button
            type="button"
            className="btn-ghost btn-xs"
            onClick={onClose}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>
        <div className="card-body settings-body">
          <p className="hint settings-intro">
            Manage categories, view full category-wise totals, and download
            PDF reports.
          </p>

          <div className="settings-section settings-reports">
            <h3>Full category totals</h3>
            <p className="hint">
              Totals from all saved items and labour in your database.
            </p>
            {hasAnyData ? (
              <>
                <CategoryTotalsBlock
                  title="Items by category"
                  rows={itemCategoryTotals}
                  fullTotal={itemsTotal}
                />
                <CategoryTotalsBlock
                  title="Labour by category"
                  rows={labourCategoryTotals}
                  fullTotal={labourTotal}
                />
                <div className="settings-grand-total">
                  <span>Grand total (items + labour)</span>
                  <strong>{formatCurrency(grandTotal)}</strong>
                </div>
              </>
            ) : (
              <p className="hint settings-empty">
                No data yet. Add items or labour to see category totals.
              </p>
            )}
          </div>

          <div className="settings-section settings-pdf-section">
            <h3>Download PDF</h3>
            <p className="hint">All report types — saved to your device.</p>
            <ul className="settings-pdf-list">
              <li>
                <SettingsPdfRow
                  label="Full report"
                  detail="Items, labour, details & totals"
                  variant="header"
                  disabled={!hasAnyData}
                  onClick={() => downloadDashboardPdf(data, dashboardTotals)}
                />
              </li>
              <li>
                <SettingsPdfRow
                  label="Category totals"
                  detail="Category-wise totals only"
                  variant="items"
                  disabled={!hasAnyData}
                  onClick={() =>
                    downloadCategoryTotalsPdf(data, dashboardTotals)
                  }
                />
              </li>
              <li>
                <SettingsPdfRow
                  label="Items billing"
                  detail="Shop bills & item lines"
                  variant="items"
                  disabled={data.itemBills.length === 0}
                  onClick={() => downloadItemsPdf(data, itemsTotal)}
                />
              </li>
              <li>
                <SettingsPdfRow
                  label="Labour billing"
                  detail="All labour entries"
                  variant="labour"
                  disabled={data.labour.length === 0}
                  onClick={() => downloadLabourPdf(data, labourTotal)}
                />
              </li>
            </ul>
          </div>

          <CategorySection
            title="Item categories"
            hint="e.g. Paint, Electrical, Plumbing"
            inputId="itemCatName"
            inputValue={itemName}
            onInputChange={setItemName}
            onAdd={addItemCategory}
            categories={settings.itemCategories}
            onRemove={removeItemCategory}
          />

          <CategorySection
            title="Labour categories"
            hint="e.g. Mason, Electrician, Helper"
            inputId="labourCatName"
            inputValue={labourName}
            onInputChange={setLabourName}
            onAdd={addLabourCategory}
            categories={settings.labourCategories}
            onRemove={removeLabourCategory}
          />
        </div>
      </section>
    </div>
  );
}

function SettingsPdfRow({
  label,
  detail,
  variant,
  disabled,
  onClick,
}: {
  label: string;
  detail: string;
  variant: "header" | "items" | "labour";
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="settings-pdf-row">
      <div className="settings-pdf-row-text">
        <strong>{label}</strong>
        <span className="hint">{detail}</span>
      </div>
      <PdfDownloadButton
        variant={variant}
        label={`Download ${label} PDF`}
        disabled={disabled}
        onClick={onClick}
      />
    </div>
  );
}

function CategorySection({
  title,
  hint,
  inputId,
  inputValue,
  onInputChange,
  onAdd,
  categories,
  onRemove,
}: {
  title: string;
  hint: string;
  inputId: string;
  inputValue: string;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  categories: Category[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="settings-section">
      <h3>{title}</h3>
      <p className="hint">{hint}</p>
      <div className="settings-add-row">
        <input
          id={inputId}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Category name"
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAdd())}
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onAdd}
          disabled={!inputValue.trim()}
        >
          Add
        </button>
      </div>
      {categories.length === 0 ? (
        <p className="hint settings-empty">No categories yet.</p>
      ) : (
        <ul className="settings-category-list">
          {categories.map((cat) => (
            <li key={cat.id}>
              <div className="settings-cat-info">
                <strong>{cat.name}</strong>
                <span className="settings-cat-time">
                  Added {formatDateTime(cat.createdAt)}
                </span>
              </div>
              <button
                type="button"
                className="btn-ghost btn-xs"
                onClick={() => onRemove(cat.id)}
                aria-label={`Remove ${cat.name}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
