import { useEffect, useMemo, useRef, useState } from "react";
import type { AppData, BillItem, ItemBill } from "./types";
import { billTotal, loadData, saveData } from "./storage";
import { createId } from "./ids";
import { formatCurrency, formatDateTime } from "./utils";
import { isGithubConnected, loadGithubConfig } from "./githubConfig";
import { pullTextFromGithub, pushTextToGithub } from "./githubTextSync";
import { TextBackupPanel, type SyncStatus } from "./TextBackupPanel";

type Screen = "home" | "edit";
type Tab = "items" | "labour";

type DraftItem = { id: string; itemName: string; price: number };

const now = () => new Date().toISOString();

export default function App() {
  const [data, setData] = useState<AppData>(loadData);
  const [screen, setScreen] = useState<Screen>("home");
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("items");
  const [textBackupAt, setTextBackupAt] = useState(() => Date.now());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local");
  const githubConfig = useRef(loadGithubConfig());
  const skipGithubPush = useRef(true);
  const githubReady = useRef(false);

  const [shopName, setShopName] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);

  const [labourDesc, setLabourDesc] = useState("");
  const [labourAmount, setLabourAmount] = useState("");

  useEffect(() => {
    const config = githubConfig.current;
    if (!isGithubConnected(config)) {
      githubReady.current = true;
      return;
    }
    setSyncStatus("loading");
    pullTextFromGithub(config)
      .then((loaded) => {
        setData(loaded);
        setTextBackupAt(Date.now());
        setSyncStatus("synced");
        githubReady.current = true;
      })
      .catch(() => {
        setSyncStatus("error");
        githubReady.current = true;
      });
  }, []);

  useEffect(() => {
    saveData(data);
    setTextBackupAt(Date.now());

    if (!githubReady.current || skipGithubPush.current) {
      skipGithubPush.current = false;
      return;
    }

    const config = githubConfig.current;
    if (!isGithubConnected(config)) {
      setSyncStatus("local");
      return;
    }

    setSyncStatus("saving");
    const timer = window.setTimeout(() => {
      pushTextToGithub(config, data)
        .then(() => setSyncStatus("synced"))
        .catch(() => setSyncStatus("error"));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [data]);

  const itemsTotal = useMemo(
    () => data.itemBills.reduce((s, b) => s + billTotal(b), 0),
    [data.itemBills]
  );
  const labourTotal = useMemo(
    () => data.labour.reduce((s, l) => s + l.amount, 0),
    [data.labour]
  );
  const grandTotal = itemsTotal + labourTotal;
  const draftTotal = draftItems.reduce((s, i) => s + i.price, 0);
  const shopLocked = draftItems.length > 0;

  const openEdit = (billId: string) => {
    setEditingBillId(billId);
    setScreen("edit");
  };

  const goHome = () => {
    setScreen("home");
    setEditingBillId(null);
  };

  const removeBill = (billId: string) => {
    setData((d) => ({
      ...d,
      itemBills: d.itemBills.filter((b) => b.id !== billId),
    }));
  };

  const addDraftItem = () => {
    const shop = shopName.trim();
    const name = itemName.trim();
    const price = parseFloat(itemPrice);
    if (!shop || !name || isNaN(price) || price < 0) return;
    setDraftItems((list) => [...list, { id: createId(), itemName: name, price }]);
    setItemName("");
    setItemPrice("");
  };

  const removeDraftItem = (id: string) => {
    setDraftItems((list) => list.filter((i) => i.id !== id));
  };

  const saveShopBill = () => {
    const shop = shopName.trim();
    if (!shop || draftItems.length === 0) return;

    const t = now();
    const bill: ItemBill = {
      id: createId(),
      shopName: shop,
      savedAt: t,
      updatedAt: t,
      items: draftItems.map((i) => ({
        id: i.id,
        itemName: i.itemName,
        price: i.price,
      })),
    };

    setData((d) => ({ ...d, itemBills: [bill, ...d.itemBills] }));
    setShopName("");
    setItemName("");
    setItemPrice("");
    setDraftItems([]);
    setActiveTab("items");
  };

  const canAddItem =
    shopName.trim() &&
    itemName.trim() &&
    !isNaN(parseFloat(itemPrice)) &&
    parseFloat(itemPrice) >= 0;

  const addLabour = (e: React.FormEvent) => {
    e.preventDefault();
    const description = labourDesc.trim();
    const amount = parseFloat(labourAmount);
    if (!description || isNaN(amount) || amount < 0) return;
    setData((d) => ({
      ...d,
      labour: [
        { id: createId(), description, amount, addedAt: now() },
        ...d.labour,
      ],
    }));
    setLabourDesc("");
    setLabourAmount("");
    setActiveTab("labour");
  };

  const removeLabour = (id: string) => {
    setData((d) => ({ ...d, labour: d.labour.filter((l) => l.id !== id) }));
  };

  if (screen === "edit" && editingBillId) {
    const bill = data.itemBills.find((b) => b.id === editingBillId);
    if (!bill) {
      goHome();
      return null;
    }
    return (
      <EditScreen
        bill={bill}
        onBack={goHome}
        onSave={(updated) => {
          setData((d) => ({
            ...d,
            itemBills: d.itemBills.map((b) =>
              b.id === updated.id ? updated : b
            ),
          }));
          goHome();
        }}
        onDelete={() => {
          removeBill(bill.id);
          goHome();
        }}
      />
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-row">
          <div>
            <h1>Shop Expense Tracker</h1>
            <p>Add items &amp; labour below · toggle saved billing with tabs</p>
          </div>
          <TextBackupPanel
            data={data}
            savedAt={textBackupAt}
            syncStatus={syncStatus}
            onConfigChange={(next) => {
              githubConfig.current = next;
              if (!isGithubConnected(next)) setSyncStatus("local");
            }}
            onDataFromGithub={(loaded) => {
              skipGithubPush.current = true;
              setData(loaded);
              setTextBackupAt(Date.now());
              setSyncStatus("synced");
            }}
          />
        </div>
      </header>

      <section className="summary-bar" aria-label="Totals">
        <div className="summary-card">
          <div className="label">Items</div>
          <div className="value">{formatCurrency(itemsTotal)}</div>
        </div>
        <div className="summary-card">
          <div className="label">Labour</div>
          <div className="value">{formatCurrency(labourTotal)}</div>
        </div>
        <div className="summary-card grand">
          <div className="label">Grand Total</div>
          <div className="value">{formatCurrency(grandTotal)}</div>
        </div>
      </section>

      <div className="main-forms">
        <section className="card">
          <div className="card-header">
            <h2>Add Item</h2>
          </div>
          <div className="card-body form-grid">
            <div>
              <label htmlFor="shopName">Shop Name</label>
              <input
                id="shopName"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="e.g. MNA"
                disabled={shopLocked}
              />
              {shopLocked && (
                <p className="hint">Shop name is set for this bill.</p>
              )}
            </div>

            <div className="item-entry-block">
              <label>Add item</label>
              <div className="add-item-fields item-entry-row">
                <input
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="Item name"
                  aria-label="Item name"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  placeholder="₹ Price"
                  aria-label="Price"
                />
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={addDraftItem}
                disabled={!canAddItem}
              >
                Add
              </button>
            </div>

            {draftItems.length > 0 && (
              <div className="billing-table-wrap">
                <table className="billing-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Price</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {draftItems.map((row) => (
                      <tr key={row.id}>
                        <td>{row.itemName}</td>
                        <td className="price-cell">
                          {formatCurrency(row.price)}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-ghost btn-xs"
                            onClick={() => removeDraftItem(row.id)}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td>Total</td>
                      <td className="price-cell">
                        <strong>{formatCurrency(draftTotal)}</strong>
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <p className="hint">Time is saved automatically when you press Save.</p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={saveShopBill}
              disabled={!shopName.trim() || draftItems.length === 0}
            >
              Save
            </button>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h2>Add Labour</h2>
          </div>
          <div className="card-body">
            <form className="form-grid" onSubmit={addLabour}>
              <div>
                <label htmlFor="labourDesc">Description</label>
                <input
                  id="labourDesc"
                  value={labourDesc}
                  onChange={(e) => setLabourDesc(e.target.value)}
                  placeholder="Mason, electrician..."
                  required
                />
              </div>
              <div className="form-row two-col">
                <div>
                  <label htmlFor="labourAmount">Amount (₹)</label>
                  <input
                    id="labourAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={labourAmount}
                    onChange={(e) => setLabourAmount(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="form-submit-col">
                  <button type="submit" className="btn btn-labour">
                    Add
                  </button>
                </div>
              </div>
            </form>
          </div>
        </section>
      </div>

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`tab ${activeTab === "items" ? "active" : ""}`}
          aria-selected={activeTab === "items"}
          onClick={() => setActiveTab("items")}
        >
          Items Billing ({data.itemBills.length})
        </button>
        <button
          type="button"
          role="tab"
          className={`tab labour ${activeTab === "labour" ? "active" : ""}`}
          aria-selected={activeTab === "labour"}
          onClick={() => setActiveTab("labour")}
        >
          Labour Billing ({data.labour.length})
        </button>
      </div>

      <div className="lists-desktop shops-layout">
        <section
          className={`card tab-panel ${activeTab === "items" ? "active" : ""} hidden-desktop full-width-panel`}
        >
          <div className="card-header">
            <h2>Saved Items Billing</h2>
            <span className="badge">{formatCurrency(itemsTotal)}</span>
          </div>
          <div className="card-body bills-body">
            {data.itemBills.length === 0 ? (
              <div className="empty-state">
                <span>📋</span>
                No saved bills yet. Add items above and press Save.
              </div>
            ) : (
              <ul className="bill-list">
                {data.itemBills.map((bill) => (
                  <SavedBillCard
                    key={bill.id}
                    bill={bill}
                    onEdit={() => openEdit(bill.id)}
                    onDelete={() => removeBill(bill.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>

        <section
          className={`card tab-panel ${activeTab === "labour" ? "active" : ""} hidden-desktop`}
        >
          <div className="card-header">
            <h2>Labour Billing</h2>
            <span
              className="badge"
              style={{
                background: "var(--labour-light)",
                color: "var(--labour)",
              }}
            >
              {formatCurrency(labourTotal)}
            </span>
          </div>
          <div className="card-body">
            {data.labour.length === 0 ? (
              <div className="empty-state">
                <span>👷</span>
                No labour entries yet. Add labour above.
              </div>
            ) : (
              <ul className="item-list">
                {data.labour.map((entry) => (
                  <li key={entry.id} className="item-card labour">
                    <div className="item-info">
                      <h3>{entry.description}</h3>
                      <span className="time">
                        🕐 {formatDateTime(entry.addedAt)}
                      </span>
                    </div>
                    <div className="item-price">
                      {formatCurrency(entry.amount)}
                    </div>
                    <div className="item-actions">
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => removeLabour(entry.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <p className="footer-note">
        Items, dates &amp; labour auto-save as text on this device and push to{" "}
        <code>data/expenses.txt</code> on GitHub when connected.
      </p>
    </div>
  );
}

function ScreenHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <div className="screen-header">
      <button type="button" className="btn-back" onClick={onBack}>
        ← Back
      </button>
      <h2>{title}</h2>
    </div>
  );
}

function EditScreen({
  bill,
  onBack,
  onSave,
  onDelete,
}: {
  bill: ItemBill;
  onBack: () => void;
  onSave: (bill: ItemBill) => void;
  onDelete: () => void;
}) {
  const [shopName, setShopName] = useState(bill.shopName);
  const [items, setItems] = useState<BillItem[]>(bill.items);
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const total = items.reduce((s, i) => s + i.price, 0);

  const addItem = () => {
    const name = itemName.trim();
    const price = parseFloat(itemPrice);
    if (!name || isNaN(price) || price < 0) return;
    setItems((list) => [...list, { id: createId(), itemName: name, price }]);
    setItemName("");
    setItemPrice("");
  };

  const startEdit = (item: BillItem) => {
    setEditingId(item.id);
    setEditName(item.itemName);
    setEditPrice(String(item.price));
  };

  const saveEdit = () => {
    if (!editingId) return;
    const name = editName.trim();
    const price = parseFloat(editPrice);
    if (!name || isNaN(price) || price < 0) return;
    setItems((list) =>
      list.map((i) =>
        i.id === editingId ? { ...i, itemName: name, price } : i
      )
    );
    setEditingId(null);
  };

  const handleSave = () => {
    const shop = shopName.trim();
    if (!shop || items.length === 0) return;
    onSave({
      ...bill,
      shopName: shop,
      items,
      updatedAt: now(),
    });
  };

  return (
    <div className="app screen-page">
      <header className="header compact">
        <h1>Edit Bill</h1>
      </header>
      <ScreenHeader title="Edit items" onBack={onBack} />

      <section className="card">
        <div className="card-body form-grid">
          <div>
            <label htmlFor="editShop">Shop Name</label>
            <input
              id="editShop"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              required
            />
          </div>

          <div className="billing-table-wrap">
            <table className="billing-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Price</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) =>
                  editingId === item.id ? (
                    <tr key={item.id} className="editing-row">
                      <td colSpan={3}>
                        <div className="edit-inline-form">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Item name"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            placeholder="Price"
                          />
                          <div className="edit-actions inline">
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={saveEdit}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={item.id}>
                      <td>{item.itemName}</td>
                      <td className="price-cell">{formatCurrency(item.price)}</td>
                      <td className="actions-cell">
                        <button
                          type="button"
                          className="btn-edit btn-xs"
                          onClick={() => startEdit(item)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-xs"
                          onClick={() =>
                            setItems((list) => list.filter((i) => i.id !== item.id))
                          }
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                )}
                <tr className="total-row">
                  <td>Total</td>
                  <td className="price-cell">
                    <strong>{formatCurrency(total)}</strong>
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="item-entry-block">
            <label>Add item</label>
            <div className="add-item-fields item-entry-row">
              <input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Item name"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={itemPrice}
                onChange={(e) => setItemPrice(e.target.value)}
                placeholder="₹ Price"
              />
            </div>
            <button type="button" className="btn btn-secondary" onClick={addItem}>
              Add
            </button>
          </div>

          <div className="screen-actions">
            <button
              type="button"
              className="btn btn-primary btn-large"
              onClick={handleSave}
              disabled={!shopName.trim() || items.length === 0}
            >
              Save changes
            </button>
            <button type="button" className="btn-ghost" onClick={onDelete}>
              Delete entire bill
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SavedBillCard({
  bill,
  onEdit,
  onDelete,
}: {
  bill: ItemBill;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const total = billTotal(bill);

  return (
    <li className="bill-card saved-bill">
      <div className="saved-bill-head">
        <p className="saved-time">🕐 {formatDateTime(bill.savedAt)}</p>
        <h3 className="saved-shop">{bill.shopName || "Shop"}</h3>
      </div>

      <div className="billing-table-wrap">
        <table className="billing-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((item) => (
              <tr key={item.id}>
                <td>{item.itemName}</td>
                <td className="price-cell">{formatCurrency(item.price)}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td>Total</td>
              <td className="price-cell">
                <strong>{formatCurrency(total)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bill-header-actions">
        <button type="button" className="btn-edit" onClick={onEdit}>
          Edit
        </button>
        <button type="button" className="btn-ghost bill-delete" onClick={onDelete}>
          Delete
        </button>
      </div>
    </li>
  );
}
