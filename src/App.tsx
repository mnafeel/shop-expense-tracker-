import { useEffect, useMemo, useRef, useState } from "react";
import type { AppData, BillItem, ItemBill, LabourEntry } from "./types";
import {
  billTotal,
  consumeLegacyLocalBackup,
  defaultData,
  normalizeAppData,
} from "./storage";
import {
  computeItemCategoryTotals,
  computeLabourCategoryTotals,
  getCategoryName,
  mergeSettings,
} from "./categories";
import { CategorySelect } from "./CategorySelect";
import { CategoryTotalsBlock } from "./CategoryTotalsBlock";
import { SettingsFab, SettingsModal } from "./SettingsModal";
import { createId } from "./ids";
import { formatCurrency, formatDateTime } from "./utils";
import {
  fetchCloudData,
  getSyncCode,
  pushCloudData,
  subscribeCloudData,
} from "./deviceSync";
import { isCloudSyncAvailable } from "./firebase";
import { SyncPanel, type SyncStatus } from "./SyncPanel";
import { PdfDownloadButton } from "./PdfDownloadButton";
import {
  computeDashboardTotals,
  downloadDashboardPdf,
  downloadItemsPdf,
  downloadLabourPdf,
} from "./export";

type Screen = "home" | "edit" | "editLabour";
type Tab = "items" | "labour";

type DraftItem = {
  id: string;
  itemName: string;
  price: number;
  categoryId: string;
};

const now = () => new Date().toISOString();

export default function App() {
  const [data, setData] = useState<AppData>(defaultData);
  const [screen, setScreen] = useState<Screen>("home");
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [editingLabourId, setEditingLabourId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("items");
  const [shopName, setShopName] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemCategoryId, setItemCategoryId] = useState("");
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [draftEditId, setDraftEditId] = useState<string | null>(null);
  const [draftEditCategoryId, setDraftEditCategoryId] = useState("");

  const [labourDesc, setLabourDesc] = useState("");
  const [labourAmount, setLabourAmount] = useState("");
  const [labourCategoryId, setLabourCategoryId] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local");
  const [syncError, setSyncError] = useState("");
  const [cloudReady, setCloudReady] = useState(false);
  const [syncKey, setSyncKey] = useState(0);
  const skipCloudPush = useRef(false);
  const lastRemoteAt = useRef(0);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    if (!isCloudSyncAvailable()) {
      setCloudReady(true);
      setSyncStatus("local");
      return;
    }

    const code = getSyncCode();
    if (!code) {
      setCloudReady(true);
      setSyncStatus("local");
      return;
    }

    setCloudReady(false);
    setSyncStatus("syncing");
    setSyncError("");
    let active = true;

    (async () => {
      try {
        const remote = await fetchCloudData(code);
        if (!active) return;

        const hasRemote =
          remote &&
          (remote.itemBills.length > 0 ||
            remote.labour.length > 0 ||
            remote.updatedAt > 0);

        if (hasRemote && remote) {
          consumeLegacyLocalBackup();
          lastRemoteAt.current = remote.updatedAt;
          skipCloudPush.current = true;
          setData(
            normalizeAppData({
              itemBills: remote.itemBills,
              labour: remote.labour,
              settings: mergeSettings(
                dataRef.current.settings,
                remote.settings
              ),
            })
          );
        } else {
          const legacy = consumeLegacyLocalBackup();
          const toSync = legacy ?? dataRef.current;
          if (legacy) {
            skipCloudPush.current = true;
            setData(legacy);
          }
          await pushCloudData(code, toSync);
          lastRemoteAt.current = Date.now();
        }
        setSyncStatus("synced");
      } catch (e) {
        if (active) {
          setSyncStatus("error");
          setSyncError(
            e instanceof Error ? e.message : "Could not connect to cloud"
          );
        }
      } finally {
        if (active) setCloudReady(true);
      }
    })();

    const unsub = subscribeCloudData(
      code,
      (remote) => {
        if (remote.updatedAt <= lastRemoteAt.current) return;
        lastRemoteAt.current = remote.updatedAt;
        skipCloudPush.current = true;
        setData((current) =>
          normalizeAppData({
            itemBills: remote.itemBills,
            labour: remote.labour,
            settings: mergeSettings(current.settings, remote.settings),
          })
        );
        setSyncStatus("synced");
        setSyncError("");
      },
      () => {
        setSyncStatus("error");
        setSyncError("Lost connection to cloud database");
      }
    );

    return () => {
      active = false;
      unsub();
    };
  }, [syncKey]);

  useEffect(() => {
    if (!isCloudSyncAvailable() || !cloudReady) return;
    const code = getSyncCode();
    if (!code) {
      setSyncStatus("local");
      return;
    }

    if (skipCloudPush.current) {
      skipCloudPush.current = false;
      return;
    }

    setSyncStatus("syncing");
    setSyncError("");
    const timer = window.setTimeout(() => {
      pushCloudData(code, data)
        .then(() => {
          lastRemoteAt.current = Date.now();
          setSyncStatus("synced");
        })
        .catch((e) => {
          setSyncStatus("error");
          setSyncError(
            e instanceof Error ? e.message : "Could not save to cloud"
          );
        });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [data, cloudReady]);

  const itemsTotal = useMemo(
    () => data.itemBills.reduce((s, b) => s + billTotal(b), 0),
    [data.itemBills]
  );
  const labourTotal = useMemo(
    () => data.labour.reduce((s, l) => s + l.amount, 0),
    [data.labour]
  );
  const grandTotal = itemsTotal + labourTotal;
  const dashboardTotals = useMemo(() => computeDashboardTotals(data), [data]);
  const draftTotal = draftItems.reduce((s, i) => s + i.price, 0);
  const shopLocked = draftItems.length > 0;
  const hasAnyData =
    data.itemBills.length > 0 || data.labour.length > 0;
  const itemCategoryTotals = useMemo(
    () => computeItemCategoryTotals(data),
    [data]
  );
  const labourCategoryTotals = useMemo(
    () => computeLabourCategoryTotals(data),
    [data]
  );

  const updateSettings = (settings: AppData["settings"]) => {
    setData((d) => ({ ...d, settings }));
  };

  const openEdit = (billId: string) => {
    setEditingLabourId(null);
    setEditingBillId(billId);
    setScreen("edit");
  };

  const openLabourEdit = (labourId: string) => {
    setEditingBillId(null);
    setEditingLabourId(labourId);
    setScreen("editLabour");
  };

  const goHome = () => {
    setScreen("home");
    setEditingBillId(null);
    setEditingLabourId(null);
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
    const cats = data.settings.itemCategories;
    if (!shop || !name || isNaN(price) || price < 0) return;
    if (cats.length > 0 && !itemCategoryId) return;
    setDraftItems((list) => [
      ...list,
      {
        id: createId(),
        itemName: name,
        price,
        categoryId: itemCategoryId,
      },
    ]);
    setItemName("");
    setItemPrice("");
  };

  const removeDraftItem = (id: string) => {
    setDraftItems((list) => list.filter((i) => i.id !== id));
    if (draftEditId === id) {
      setDraftEditId(null);
      setDraftEditCategoryId("");
    }
  };

  const startDraftCategoryEdit = (row: DraftItem) => {
    setDraftEditId(row.id);
    setDraftEditCategoryId(row.categoryId);
  };

  const saveDraftCategoryEdit = () => {
    if (!draftEditId) return;
    if (itemCats.length > 0 && !draftEditCategoryId) return;
    setDraftItems((list) =>
      list.map((i) =>
        i.id === draftEditId ? { ...i, categoryId: draftEditCategoryId } : i
      )
    );
    setDraftEditId(null);
    setDraftEditCategoryId("");
  };

  const handleMainCategoryChange = (categoryId: string) => {
    setItemCategoryId(categoryId);
    if (itemCats.length > 0 && !categoryId) return;
    setDraftItems((list) => list.map((i) => ({ ...i, categoryId })));
    setDraftEditId(null);
    setDraftEditCategoryId("");
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
        categoryId: i.categoryId,
      })),
    };

    setData((d) => ({ ...d, itemBills: [bill, ...d.itemBills] }));
    setShopName("");
    setItemName("");
    setItemPrice("");
    setItemCategoryId("");
    setDraftItems([]);
    setDraftEditId(null);
    setActiveTab("items");
  };

  const itemCats = data.settings.itemCategories;
  const labourCats = data.settings.labourCategories;

  const canAddItem =
    shopName.trim() &&
    itemName.trim() &&
    !isNaN(parseFloat(itemPrice)) &&
    parseFloat(itemPrice) >= 0 &&
    (itemCats.length === 0 || !!itemCategoryId);

  const addLabour = (e: React.FormEvent) => {
    e.preventDefault();
    const description = labourDesc.trim();
    const amount = parseFloat(labourAmount);
    if (!description || isNaN(amount) || amount < 0) return;
    if (labourCats.length > 0 && !labourCategoryId) return;
    setData((d) => ({
      ...d,
      labour: [
        {
          id: createId(),
          description,
          amount,
          addedAt: now(),
          categoryId: labourCategoryId,
        },
        ...d.labour,
      ],
    }));
    setLabourDesc("");
    setLabourAmount("");
    setLabourCategoryId("");
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
        itemCategories={data.settings.itemCategories}
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

  if (screen === "editLabour" && editingLabourId) {
    const entry = data.labour.find((l) => l.id === editingLabourId);
    if (!entry) {
      goHome();
      return null;
    }
    return (
      <EditLabourScreen
        entry={entry}
        labourCategories={data.settings.labourCategories}
        onBack={goHome}
        onSave={(updated) => {
          setData((d) => ({
            ...d,
            labour: d.labour.map((l) => (l.id === updated.id ? updated : l)),
          }));
          goHome();
        }}
        onDelete={() => {
          removeLabour(entry.id);
          goHome();
        }}
      />
    );
  }

  return (
    <div className="app">
      <SettingsFab onClick={() => setSettingsOpen(true)} />
      {settingsOpen && (
        <SettingsModal
          settings={data.settings}
          onClose={() => setSettingsOpen(false)}
          onChange={updateSettings}
        />
      )}
      <header className="header">
        <div className="header-row">
          <div>
            <h1>Shop Expense Tracker</h1>
            <p>Add items &amp; labour · auto-saves to cloud database</p>
          </div>
          <div className="header-actions">
            <PdfDownloadButton
              variant="header"
              label="Download full PDF report"
              disabled={!hasAnyData}
              onClick={() => downloadDashboardPdf(data, dashboardTotals)}
            />
            <SyncPanel
              syncStatus={syncStatus}
              syncError={syncError}
              onCodeChange={() => {
                setSyncError("");
                setSyncKey((k) => k + 1);
              }}
            />
          </div>
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

            <CategorySelect
              id="itemCategory"
              label="Main category"
              value={itemCategoryId}
              categories={itemCats}
              onChange={handleMainCategoryChange}
              required={itemCats.length > 0}
              hint={
                itemCats.length === 0
                  ? "Open Settings (gear icon) to add item categories."
                  : draftItems.length > 0
                    ? "Changing main category updates all items in this bill. Tap Edit on a row for one item only."
                    : "All items you add will use this category."
              }
            />

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
                      <th>Category</th>
                      <th>Item</th>
                      <th>Price</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {draftItems.map((row) =>
                      draftEditId === row.id ? (
                        <tr key={row.id} className="editing-row">
                          <td colSpan={4}>
                            <div className="edit-inline-form draft-category-edit">
                              <CategorySelect
                                id={`draft-cat-${row.id}`}
                                label="Change category for this item"
                                value={draftEditCategoryId}
                                categories={itemCats}
                                onChange={setDraftEditCategoryId}
                                required={itemCats.length > 0}
                              />
                              <div className="edit-actions inline">
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={saveDraftCategoryEdit}
                                  disabled={
                                    itemCats.length > 0 && !draftEditCategoryId
                                  }
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setDraftEditId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={row.id}>
                          <td>
                            {getCategoryName(
                              row.categoryId,
                              data.settings.itemCategories
                            )}
                          </td>
                          <td>{row.itemName}</td>
                          <td className="price-cell">
                            {formatCurrency(row.price)}
                          </td>
                          <td className="actions-cell">
                            {itemCats.length > 0 && (
                              <button
                                type="button"
                                className="btn-edit btn-xs"
                                onClick={() => startDraftCategoryEdit(row)}
                              >
                                Edit
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn-ghost btn-xs"
                              onClick={() => removeDraftItem(row.id)}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      )
                    )}
                    <tr className="total-row">
                      <td colSpan={3}>Total</td>
                      <td className="price-cell">
                        <strong>{formatCurrency(draftTotal)}</strong>
                      </td>
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
              <CategorySelect
                id="labourCategory"
                label="Category"
                value={labourCategoryId}
                categories={labourCats}
                onChange={setLabourCategoryId}
                required={labourCats.length > 0}
                hint={
                  labourCats.length === 0
                    ? "Open Settings (gear icon) to add labour categories."
                    : undefined
                }
              />
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
            <div className="card-header-end">
              <span className="badge">{formatCurrency(itemsTotal)}</span>
              <PdfDownloadButton
                variant="items"
                label="Download items billing PDF"
                disabled={data.itemBills.length === 0}
                onClick={() => downloadItemsPdf(data, itemsTotal)}
              />
            </div>
          </div>
          <div className="card-body bills-body">
            <CategoryTotalsBlock
              title="By category"
              rows={itemCategoryTotals}
              fullTotal={itemsTotal}
            />
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
                    itemCategories={data.settings.itemCategories}
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
            <div className="card-header-end">
              <span
                className="badge"
                style={{
                  background: "var(--labour-light)",
                  color: "var(--labour)",
                }}
              >
                {formatCurrency(labourTotal)}
              </span>
              <PdfDownloadButton
                variant="labour"
                label="Download labour billing PDF"
                disabled={data.labour.length === 0}
                onClick={() => downloadLabourPdf(data, labourTotal)}
              />
            </div>
          </div>
          <div className="card-body">
            <CategoryTotalsBlock
              title="By category"
              rows={labourCategoryTotals}
              fullTotal={labourTotal}
            />
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
                      <span className="item-category-tag">
                        {getCategoryName(
                          entry.categoryId,
                          data.settings.labourCategories
                        )}
                      </span>
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
                        className="btn-edit"
                        onClick={() => openLabourEdit(entry.id)}
                      >
                        Edit
                      </button>
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
        Data saves automatically to the cloud database when connected. Set a sync
        code once, then use the same code on every device.
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

function EditLabourScreen({
  entry,
  labourCategories,
  onBack,
  onSave,
  onDelete,
}: {
  entry: LabourEntry;
  labourCategories: AppData["settings"]["labourCategories"];
  onBack: () => void;
  onSave: (entry: LabourEntry) => void;
  onDelete: () => void;
}) {
  const [categoryId, setCategoryId] = useState(entry.categoryId);
  const [description, setDescription] = useState(entry.description);
  const [amount, setAmount] = useState(String(entry.amount));

  const handleSave = () => {
    const desc = description.trim();
    const parsed = parseFloat(amount);
    if (!desc || isNaN(parsed) || parsed < 0) return;
    if (labourCategories.length > 0 && !categoryId) return;
    onSave({
      ...entry,
      categoryId,
      description: desc,
      amount: parsed,
    });
  };

  return (
    <div className="app screen-page labour-edit-page">
      <header className="header compact">
        <h1>Edit Labour</h1>
      </header>
      <ScreenHeader title="Edit labour entry" onBack={onBack} />

      <section className="card labour-card">
        <div className="card-body form-grid">
          <p className="hint labour-time-hint">
            Added: {formatDateTime(entry.addedAt)}
          </p>
          <CategorySelect
            id="editLabourCategory"
            label="Category"
            value={categoryId}
            categories={labourCategories}
            onChange={setCategoryId}
            required={labourCategories.length > 0}
          />
          <div>
            <label htmlFor="editLabourDesc">Description</label>
            <input
              id="editLabourDesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mason, electrician..."
              required
            />
          </div>
          <div>
            <label htmlFor="editLabourAmount">Amount (₹)</label>
            <input
              id="editLabourAmount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div className="screen-actions">
            <button
              type="button"
              className="btn btn-labour btn-large"
              onClick={handleSave}
              disabled={
                !description.trim() ||
                isNaN(parseFloat(amount)) ||
                parseFloat(amount) < 0 ||
                (labourCategories.length > 0 && !categoryId)
              }
            >
              Save changes
            </button>
            <button type="button" className="btn-ghost" onClick={onDelete}>
              Delete entry
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function EditScreen({
  bill,
  itemCategories,
  onBack,
  onSave,
  onDelete,
}: {
  bill: ItemBill;
  itemCategories: AppData["settings"]["itemCategories"];
  onBack: () => void;
  onSave: (bill: ItemBill) => void;
  onDelete: () => void;
}) {
  const [shopName, setShopName] = useState(bill.shopName);
  const [items, setItems] = useState<BillItem[]>(bill.items);
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemCategoryId, setItemCategoryId] = useState(
    () => bill.items.find((i) => i.categoryId)?.categoryId ?? ""
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editError, setEditError] = useState("");

  const total = items.reduce((s, i) => s + i.price, 0);
  const needsCategory = itemCategories.length > 0;
  const canSaveInlineEdit =
    !needsCategory ||
    (!!editCategoryId &&
      editName.trim() &&
      !isNaN(parseFloat(editPrice)) &&
      parseFloat(editPrice) >= 0);
  const allItemsCategorized =
    !needsCategory || items.every((i) => !!i.categoryId);

  const handleMainCategoryChange = (categoryId: string) => {
    setItemCategoryId(categoryId);
    if (needsCategory && !categoryId) return;
    setItems((list) => list.map((i) => ({ ...i, categoryId })));
    setEditingId(null);
    setEditError("");
  };

  const addItem = () => {
    const name = itemName.trim();
    const price = parseFloat(itemPrice);
    if (!name || isNaN(price) || price < 0) return;
    if (needsCategory && !itemCategoryId) return;
    setItems((list) => [
      ...list,
      {
        id: createId(),
        itemName: name,
        price,
        categoryId: itemCategoryId,
      },
    ]);
    setItemName("");
    setItemPrice("");
  };

  const startEdit = (item: BillItem) => {
    setEditingId(item.id);
    setEditName(item.itemName);
    setEditPrice(String(item.price));
    setEditCategoryId(item.categoryId);
    setEditError("");
  };

  const saveEdit = () => {
    if (!editingId) return;
    const name = editName.trim();
    const price = parseFloat(editPrice);
    if (!name || isNaN(price) || price < 0) {
      setEditError("Enter a valid item name and price.");
      return;
    }
    if (needsCategory && !editCategoryId) {
      setEditError("Select a category for this item.");
      return;
    }
    setItems((list) =>
      list.map((i) =>
        i.id === editingId
          ? { ...i, itemName: name, price, categoryId: editCategoryId }
          : i
      )
    );
    setEditingId(null);
    setEditError("");
  };

  const handleSave = () => {
    const shop = shopName.trim();
    if (!shop || items.length === 0) return;
    if (!allItemsCategorized) return;
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
                  <th>Category</th>
                  <th>Item</th>
                  <th>Price</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) =>
                  editingId === item.id ? (
                    <tr key={item.id} className="editing-row">
                      <td colSpan={4}>
                        <div className="edit-inline-form">
                          <CategorySelect
                            id={`edit-cat-${item.id}`}
                            label="Category"
                            value={editCategoryId}
                            categories={itemCategories}
                            onChange={setEditCategoryId}
                            required={itemCategories.length > 0}
                          />
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
                          {editError && (
                            <p className="hint sync-error">{editError}</p>
                          )}
                          <div className="edit-actions inline">
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={saveEdit}
                              disabled={!canSaveInlineEdit}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setEditingId(null);
                                setEditError("");
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={item.id}>
                      <td>
                        {getCategoryName(item.categoryId, itemCategories)}
                      </td>
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
                  <td colSpan={3}>Total</td>
                  <td className="price-cell">
                    <strong>{formatCurrency(total)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <CategorySelect
            id="editNewItemCategory"
            label="Main category"
            value={itemCategoryId}
            categories={itemCategories}
            onChange={handleMainCategoryChange}
            required={itemCategories.length > 0}
            hint={
              itemCategories.length === 0
                ? undefined
                : items.length > 0
                  ? "Changing main category updates every item in this bill. Tap Edit on a row for one item only."
                  : "All items will use this category."
            }
          />

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
            <button
              type="button"
              className="btn btn-secondary"
              onClick={addItem}
              disabled={
                !itemName.trim() ||
                isNaN(parseFloat(itemPrice)) ||
                parseFloat(itemPrice) < 0 ||
                (needsCategory && !itemCategoryId)
              }
            >
              Add
            </button>
          </div>

          {!allItemsCategorized && (
            <p className="hint sync-error">
              Each item needs a category. Tap Edit on a row to set or change it.
            </p>
          )}

          <div className="screen-actions">
            <button
              type="button"
              className="btn btn-primary btn-large"
              onClick={handleSave}
              disabled={
                !shopName.trim() || items.length === 0 || !allItemsCategorized
              }
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
  itemCategories,
  onEdit,
  onDelete,
}: {
  bill: ItemBill;
  itemCategories: AppData["settings"]["itemCategories"];
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
              <th>Category</th>
              <th>Item</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((item) => (
              <tr key={item.id}>
                <td>{getCategoryName(item.categoryId, itemCategories)}</td>
                <td>{item.itemName}</td>
                <td className="price-cell">{formatCurrency(item.price)}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td colSpan={2}>Total</td>
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
