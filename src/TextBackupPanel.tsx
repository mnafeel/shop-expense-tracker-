import { useMemo, useState } from "react";
import type { AppData } from "./types";
import { dataToText } from "./textBackup";
import {
  githubFileUrl,
  isGithubConnected,
  loadGithubConfig,
  saveGithubConfig,
  type GithubConfig,
} from "./githubConfig";
import {
  clearGithubShaCache,
  pullTextFromGithub,
  pushTextToGithub,
} from "./githubTextSync";

export type SyncStatus = "local" | "loading" | "saving" | "synced" | "error";

export function TextBackupPanel({
  data,
  savedAt,
  syncStatus,
  onConfigChange,
  onDataFromGithub,
}: {
  data: AppData;
  savedAt: number;
  syncStatus: SyncStatus;
  onConfigChange: (config: GithubConfig) => void;
  onDataFromGithub: (data: AppData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [config, setConfig] = useState<GithubConfig>(loadGithubConfig);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const text = useMemo(() => dataToText(data), [data, savedAt]);
  const connected = isGithubConnected(config);

  const applyConfig = (next: GithubConfig) => {
    setConfig(next);
    saveGithubConfig(next);
    onConfigChange(next);
  };

  const statusLabel = () => {
    if (!connected) return "Connect GitHub";
    if (syncStatus === "loading") return "Loading from GitHub…";
    if (syncStatus === "saving") return "Pushing to GitHub…";
    if (syncStatus === "error") return "GitHub sync failed";
    if (syncStatus === "synced") return "Synced to GitHub";
    return "GitHub connected";
  };

  const connectGithub = async () => {
    if (!config.token.trim()) {
      setMessage("Paste your GitHub token first.");
      return;
    }
    const next = { ...config, connected: true };
    applyConfig(next);
    setBusy(true);
    setMessage("");
    try {
      clearGithubShaCache();
      await pushTextToGithub(next, data);
      setMessage("Connected. All data auto-saves to data/expenses.txt.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not push to GitHub");
    } finally {
      setBusy(false);
    }
  };

  const pullGithub = async () => {
    if (!connected) return;
    setBusy(true);
    setMessage("");
    try {
      clearGithubShaCache();
      const loaded = await pullTextFromGithub(config);
      onDataFromGithub(loaded);
      setMessage("Loaded from GitHub.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Load failed");
    } finally {
      setBusy(false);
    }
  };

  const copyBackup = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const downloadBackup = () => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <button
        type="button"
        className={`text-backup-btn ${connected && syncStatus === "synced" ? "synced" : ""}`}
        onClick={() => setOpen(true)}
        title="Text backup & GitHub sync"
      >
        <span className="text-backup-dot" aria-hidden />
        {statusLabel()}
      </button>

      {open && (
        <div className="text-backup-backdrop" onClick={() => setOpen(false)}>
          <section
            className="text-backup-modal card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="text-backup-title"
          >
            <div className="card-header">
              <h2 id="text-backup-title">Text backup → GitHub</h2>
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
              <p className="hint">
                Items, dates, and labour auto-save as plain text in your repo:{" "}
                <code>data/expenses.txt</code>. Open the app on any device after
                connecting once.
              </p>

              <div className="form-row two-col">
                <div>
                  <label htmlFor="ghOwner">GitHub username</label>
                  <input
                    id="ghOwner"
                    value={config.owner}
                    onChange={(e) =>
                      applyConfig({ ...config, owner: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label htmlFor="ghRepo">Repository</label>
                  <input
                    id="ghRepo"
                    value={config.repo}
                    onChange={(e) =>
                      applyConfig({ ...config, repo: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ghToken">GitHub token (one-time)</label>
                <input
                  id="ghToken"
                  type="password"
                  value={config.token}
                  onChange={(e) =>
                    applyConfig({ ...config, token: e.target.value })
                  }
                  placeholder="ghp_..."
                  autoComplete="off"
                />
                <p className="hint">
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Create token
                  </a>{" "}
                  — classic: <strong>repo</strong>. Fine-grained:{" "}
                  <strong>Contents</strong> read &amp; write.
                </p>
              </div>

              {!connected ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={connectGithub}
                  disabled={busy}
                >
                  {busy ? "Connecting…" : "Connect & push to GitHub"}
                </button>
              ) : (
                <div className="text-backup-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={pullGithub}
                    disabled={busy}
                  >
                    Load from GitHub
                  </button>
                  <a
                    className="btn btn-ghost"
                    href={githubFileUrl(config)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on GitHub
                  </a>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() =>
                      applyConfig({ ...config, connected: false })
                    }
                  >
                    Disconnect
                  </button>
                </div>
              )}

              {message && (
                <p
                  className={`sync-msg ${
                    message.includes("fail") ||
                    message.includes("Token") ||
                    message.includes("Cannot")
                      ? "sync-error"
                      : "sync-ok"
                  }`}
                >
                  {message}
                </p>
              )}

              <hr className="backup-divider" />

              <p className="hint">
                Preview (same text stored locally and on GitHub):
              </p>
              <textarea
                className="text-backup-preview"
                readOnly
                value={text}
                rows={10}
                aria-label="Backup text preview"
              />
              <div className="text-backup-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={copyBackup}
                >
                  {copied ? "Copied" : "Copy text"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={downloadBackup}
                >
                  Download .txt
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
