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
                <p className="hint sync-error">
                  Cloud sync is not configured for this app build. Add Firebase
                  keys to enable automatic sync across devices.
                </p>
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
