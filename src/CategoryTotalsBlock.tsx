import type { CategoryTotalRow } from "./categories";
import { formatCurrency } from "./utils";

export function CategoryTotalsBlock({
  title,
  rows,
  fullTotal,
}: {
  title: string;
  rows: CategoryTotalRow[];
  fullTotal: number;
}) {
  if (fullTotal <= 0 && rows.length === 0) return null;

  return (
    <div className="category-totals">
      <h3 className="category-totals-title">{title}</h3>
      {rows.length > 0 ? (
        <ul className="category-totals-list">
          {rows.map((row) => (
            <li key={row.categoryId || row.name} className="category-totals-row">
              <span className="category-totals-name">{row.name}</span>
              <span className="category-totals-amount">
                {formatCurrency(row.total)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint category-totals-empty">No category totals yet.</p>
      )}
      <div className="category-totals-full">
        <span>Full total</span>
        <strong>{formatCurrency(fullTotal)}</strong>
      </div>
    </div>
  );
}
