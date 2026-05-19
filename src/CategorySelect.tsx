import type { Category } from "./types";

export function CategorySelect({
  id,
  label,
  value,
  categories,
  onChange,
  required,
  hint,
  disabled: disabledProp,
}: {
  id: string;
  label: string;
  value: string;
  categories: Category[];
  onChange: (categoryId: string) => void;
  required?: boolean;
  hint?: string;
  disabled?: boolean;
}) {
  const disabled = disabledProp || categories.length === 0;

  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
      >
        <option value="">
          {categories.length === 0
            ? "Add categories in Settings"
            : "Select category"}
        </option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
