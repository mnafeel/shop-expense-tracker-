import type { CategoryTotalRow } from "./categories";
import { formatCurrency } from "./utils";

export function CategoryTotalsBlock({
  title,
  rows,
  fullTotal,
  selectedCategoryId = null,
  onSelectCategory,
}: {
  title: string;
  rows: CategoryTotalRow[];
  fullTotal: number;
  selectedCategoryId?: string | null;
  onSelectCategory?: (categoryId: string | null) => void;
}) {
  if (fullTotal <= 0 && rows.length === 0) return null;

  const selectable = !!onSelectCategory;
  const selectedRow = selectedCategoryId
    ? rows.find((row) => row.categoryId === selectedCategoryId)
    : null;
  const visibleRows = selectedCategoryId
    ? selectedRow
      ? [selectedRow]
      : []
    : rows;
  const displayTotal = selectedCategoryId
    ? selectedRow?.total ?? 0
    : fullTotal;

  return (
    <div className="category-totals">
      <div className="category-totals-head">
        <h3 className="category-totals-title">{title}</h3>
        {selectable && selectedCategoryId && (
          <button
            type="button"
            className="category-filter-clear"
            onClick={() => onSelectCategory!(null)}
          >
            Show all
          </button>
        )}
      </div>
      {selectable && !selectedCategoryId && rows.length > 0 && (
        <p className="hint category-totals-hint">
          Tap a category to view and download that category only.
        </p>
      )}
      {visibleRows.length > 0 ? (
        <ul className="category-totals-list">
          {visibleRows.map((row) => {
            const isSelected = selectedCategoryId === row.categoryId;
            const content = (
              <>
                <span className="category-totals-name">{row.name}</span>
                <span className="category-totals-amount">
                  {formatCurrency(row.total)}
                </span>
              </>
            );
            return (
              <li
                key={row.categoryId || row.name}
                className={`category-totals-row${isSelected ? " selected" : ""}${selectable ? " selectable" : ""}`}
              >
                {selectable ? (
                  <button
                    type="button"
                    className="category-totals-btn"
                    aria-pressed={isSelected}
                    onClick={() =>
                      onSelectCategory!(
                        selectedCategoryId === row.categoryId
                          ? null
                          : row.categoryId
                      )
                    }
                  >
                    {content}
                  </button>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      ) : selectedCategoryId ? (
        <p className="hint category-totals-empty">No items in this category.</p>
      ) : (
        <p className="hint category-totals-empty">No category totals yet.</p>
      )}
      <div className="category-totals-full">
        <span>{selectedCategoryId ? "Category total" : "Full total"}</span>
        <strong>{formatCurrency(displayTotal)}</strong>
      </div>
    </div>
  );
}
