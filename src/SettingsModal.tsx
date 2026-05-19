import { useState } from "react";
import type { AppSettings, Category } from "./types";
import { createCategory } from "./categories";
import { formatDateTime } from "./utils";

export function SettingsFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="settings-fab"
      onClick={onClick}
      aria-label="Open settings"
      title="Settings — manage categories"
    >
      <SettingsIcon />
    </button>
  );
}

export function SettingsModal({
  settings,
  onClose,
  onChange,
}: {
  settings: AppSettings;
  onClose: () => void;
  onChange: (settings: AppSettings) => void;
}) {
  const [itemName, setItemName] = useState("");
  const [labourName, setLabourName] = useState("");

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
            Add category names here. They appear in dropdowns when you add items
            or labour. Reports show each category total, then the full total.
          </p>

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
