import { useState } from "react";
import type { AppData } from "./types";
import {
  isGithubConnected,
  loadGithubConfig,
  saveGithubConfig,
  type GithubConfig,
} from "./githubConfig";
import { clearGithubCache, syncFromGithub, syncToGithub } from "./githubStorage";

type SyncStatus = "local" | "loading" | "saving" | "saved" | "error";

export function GithubBackup({
  data,
  syncStatus,
  onConfigChange,
  onDataLoaded,
}: {
  data: AppData;
  syncStatus: SyncStatus;
  onConfigChange: (config: GithubConfig) => void;
  onDataLoaded: (data: AppData) => void;
}) {
  const [config, setConfig] = useState<GithubConfig>(loadGithubConfig);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const connected = isGithubConnected(config);

  const applyConfig = (next: GithubConfig) => {
    setConfig(next);
    saveGithubConfig(next);
    onConfigChange(next);
  };

  const connect = async () => {
    if (!config.token.trim()) {
      setMessage("Paste your GitHub token first.");
      return;
    }
    const next: GithubConfig = { ...config, connected: true };
    applyConfig(next);
    setBusy(true);
    setMessage("");
    try {
      clearGithubCache();
      await syncToGithub(next, data);
      setMessage("Connected. Text backup saves to data/expenses.txt.");
      setOpen(false);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save to GitHub");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => {
    applyConfig({ ...config, connected: false });
    setMessage("");
  };

  const pullFromGithub = async () => {
    if (!connected) return;
    setBusy(true);
    setMessage("");
    try {
      clearGithubCache();
      const loaded = await syncFromGithub(config);
      onDataLoaded(loaded);
      setMessage("Loaded from GitHub.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Load failed");
    } finally {
      setBusy(false);
    }
  };

  const statusText = () => {
    if (!connected) return "Local only";
    if (syncStatus === "loading") return "Loading from GitHub…";
    if (syncStatus === "saving") return "Saving text to GitHub…";
    if (syncStatus === "saved") return "Saved to GitHub";
    if (syncStatus === "error") return "GitHub save failed";
    return "Auto-save: GitHub";
  };

  return (
    <>
      <button
        type="button"
        className={`cloud-status-btn ${connected ? "connected" : ""}`}
        onClick={() => setOpen(true)}
        title="GitHub text backup"
      >
        <span className="cloud-dot" aria-hidden />
        {statusText()}
      </button>

      {open && (
        <div
          className="cloud-modal-backdrop"
          onClick={() => setOpen(false)}
        >
          <section
            className="cloud-modal card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="github-backup-title"
          >
            <div className="card-header">
              <h2 id="github-backup-title">GitHub text backup</h2>
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
                Saves a readable <strong>text file</strong> in your repo:{" "}
                <code>data/expenses.txt</code>. When you add items or labour,
                it updates automatically.
              </p>

              <div className="form-row two-col">
                <div>
                  <label htmlFor="ghOwner">Username</label>
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
                <label htmlFor="ghToken">GitHub token</label>
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
                  </a>
                  — classic: <strong>repo</strong> scope. Fine-grained:{" "}
                  <strong>Contents</strong> read &amp; write.
                </p>
              </div>

              {!connected ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={connect}
                  disabled={busy}
                >
                  {busy ? "Connecting…" : "Connect GitHub backup"}
                </button>
              ) : (
                <div className="cloud-connected-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={pullFromGithub}
                    disabled={busy}
                  >
                    Load from GitHub
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={disconnect}
                  >
                    Disconnect
                  </button>
                </div>
              )}

              {message && (
                <p
                  className={`sync-msg ${
                    message.includes("fail") ||
                    message.includes("Cannot") ||
                    message.includes("Token")
                      ? "sync-error"
                      : "sync-ok"
                  }`}
                >
                  {message}
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
