import { useState } from "react";
import {
  clearSyncCode,
  createSyncCode,
  getSyncCode,
  saveSyncCode,
} from "./deviceSync";
import { isCloudSyncAvailable } from "./firebase";

export type SyncStatus = "local" | "syncing" | "synced" | "error";

export function SyncPanel({
  syncStatus,
  syncError,
  onCodeChange,
}: {
  syncStatus: SyncStatus;
  syncError?: string;
  onCodeChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");
  const code = getSyncCode();
  const cloudOk = isCloudSyncAvailable();

  const statusLabel = () => {
    if (!cloudOk) return "Database setup needed";
    if (!code) return "Connect once";
    if (syncStatus === "syncing") return "Saving to cloud…";
    if (syncStatus === "error") return "Cloud save failed";
    if (syncStatus === "synced") return "Saved to cloud";
    return `Cloud · ${code}`;
  };

  const applyCode = (newCode: string) => {
    saveSyncCode(newCode);
    onCodeChange();
    setMessage(
      `Connected. All items and labour now save to the database automatically.`
    );
    setOpen(false);
  };

  const handleCreate = () => {
    applyCode(createSyncCode());
  };

  const handleJoin = () => {
    const trimmed = input.trim().toUpperCase();
    if (trimmed.length < 4) {
      setMessage("Enter at least 4 characters.");
      return;
    }
    applyCode(trimmed);
  };

  const handleDisconnect = () => {
    clearSyncCode();
    onCodeChange();
    setOpen(false);
    setMessage("");
  };

  return (
    <>
      <button
        type="button"
        className={`sync-status-btn ${syncStatus === "synced" && code ? "synced" : ""}`}
        onClick={() => setOpen(true)}
      >
        <span className="sync-dot" aria-hidden />
        {statusLabel()}
      </button>

      {open && (
        <div className="sync-modal-backdrop" onClick={() => setOpen(false)}>
          <section
            className="sync-modal card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="sync-title"
          >
            <div className="card-header">
              <h2 id="sync-title">Cloud database</h2>
              <button
                type="button"
                className="btn-ghost btn-xs"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="card-body form-grid">
              {!cloudOk ? (
                <div className="firebase-setup">
                  <p className="hint sync-error">
                    Firebase database is not connected on this build.
                  </p>
                  <p className="hint">
                    In{" "}
                    <a
                      href="https://console.firebase.google.com/project/shop-expense-tracker-cf6ae/firestore"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Firebase Console
                    </a>
                    : enable <strong>Firestore</strong>, publish rules from{" "}
                    <code>firestore.rules</code>, then redeploy the app.
                  </p>
                </div>
              ) : (
                <>
                  <p className="hint">
                    Connect once with a sync code. Every item, date, and labour
                    entry saves to the <strong>Firestore database</strong>{" "}
                    automatically — no backup buttons needed.
                  </p>

                  {code ? (
                    <>
                      <p className="sync-code-display">
                        Sync code: <strong>{code}</strong>
                      </p>
                      <p className="hint">
                        Use this same code on phone, laptop, or tablet. Changes
                        appear on all devices within seconds.
                      </p>
                      {syncStatus === "synced" && (
                        <p className="sync-msg sync-ok">
                          Database connected — auto-save is on.
                        </p>
                      )}
                      {syncError && (
                        <p className="sync-msg sync-error">{syncError}</p>
                      )}
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={handleDisconnect}
                      >
                        Use a different code
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleCreate}
                      >
                        Create sync code
                      </button>
                      <p className="hint">Or join an existing database:</p>
                      <input
                        value={input}
                        onChange={(e) =>
                          setInput(e.target.value.toUpperCase())
                        }
                        placeholder="Enter code e.g. ABC123"
                        maxLength={12}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleJoin}
                      >
                        Connect
                      </button>
                    </>
                  )}
                </>
              )}

              {message && <p className="sync-msg sync-ok">{message}</p>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
