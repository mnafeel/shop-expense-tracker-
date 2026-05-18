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
  onCodeChange,
}: {
  syncStatus: SyncStatus;
  onCodeChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");
  const code = getSyncCode();
  const cloudOk = isCloudSyncAvailable();

  const statusLabel = () => {
    if (!cloudOk) return "Sync setup needed";
    if (!code) return "Set up sync";
    if (syncStatus === "syncing") return "Syncing…";
    if (syncStatus === "error") return "Sync error";
    if (syncStatus === "synced") return `Synced · ${code}`;
    return `Sync · ${code}`;
  };

  const applyCode = (newCode: string) => {
    saveSyncCode(newCode);
    onCodeChange();
    setMessage(`Sync code ${newCode} — use the same code on your other devices.`);
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
        className={`sync-status-btn ${syncStatus === "synced" ? "synced" : ""}`}
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
              <h2 id="sync-title">Sync all devices</h2>
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
                    Firebase is not connected yet. Complete these steps once:
                  </p>
                  <ol className="hint setup-steps">
                    <li>
                      Open{" "}
                      <a
                        href="https://console.firebase.google.com"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Firebase Console
                      </a>{" "}
                      → Create project (e.g. <code>shop-expense-tracker</code>)
                    </li>
                    <li>
                      <strong>Build → Firestore Database</strong> → Create
                      database (start in test mode)
                    </li>
                    <li>
                      <strong>Rules</strong> tab → paste rules from{" "}
                      <code>firestore.rules</code> in your GitHub repo →
                      Publish
                    </li>
                    <li>
                      <strong>Project settings → Your apps → Web (&lt;/&gt;)</strong>{" "}
                      → register app → copy the config values
                    </li>
                    <li>
                      GitHub repo → <strong>Settings → Secrets → Actions</strong>{" "}
                      → add all 6 <code>VITE_FIREBASE_*</code> secrets
                    </li>
                    <li>
                      Firebase → <strong>Authentication → Settings</strong> →
                      Authorized domains → add <code>mnafeel.github.io</code>
                    </li>
                    <li>
                      Re-run deploy (push to <code>main</code> or Actions →
                      Run workflow)
                    </li>
                  </ol>
                  <p className="hint">
                    After deploy, refresh this page → <strong>Set up sync</strong>{" "}
                    → create a code → use the same code on every device.
                  </p>
                </div>
              ) : (
                <>
                  <p className="hint">
                    No backup buttons — your items, dates, and labour save to
                    the cloud <strong>automatically</strong> and appear on every
                    device that uses the <strong>same sync code</strong>.
                  </p>

                  {code ? (
                    <>
                      <p className="sync-code-display">
                        Your code: <strong>{code}</strong>
                      </p>
                      <p className="hint">
                        On phone, laptop, or tablet: open this app → enter this
                        code. Changes sync within seconds.
                      </p>
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
                        Create new sync code
                      </button>
                      <p className="hint">Or join an existing one:</p>
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
                        Connect with code
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
