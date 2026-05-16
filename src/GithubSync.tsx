import { useState } from "react";
import type { AppData } from "./types";
import {
  isGithubConfigured,
  loadGithubConfig,
  saveGithubConfig,
  type GithubConfig,
} from "./githubConfig";
import { clearGithubCache, syncFromGithub, syncToGithub } from "./githubStorage";

type SyncStatus = "idle" | "loading" | "saving" | "saved" | "error";

export function GithubSyncPanel({
  data,
  onDataLoaded,
  onConfigChange,
}: {
  data: AppData;
  onDataLoaded: (data: AppData) => void;
  onConfigChange?: (config: GithubConfig) => void;
}) {
  const [config, setConfig] = useState<GithubConfig>(loadGithubConfig);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [message, setMessage] = useState("");

  const configured = isGithubConfigured(config);

  const updateConfig = (patch: Partial<GithubConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveGithubConfig(next);
    onConfigChange?.(next);
  };

  const handleLoad = async () => {
    if (!configured) return;
    setStatus("loading");
    setMessage("");
    try {
      clearGithubCache();
      const loaded = await syncFromGithub(config);
      onDataLoaded(loaded);
      setStatus("saved");
      setMessage("Loaded from GitHub.");
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Load failed");
    }
  };

  const handleSave = async () => {
    if (!configured) return;
    setStatus("saving");
    setMessage("");
    try {
      await syncToGithub(config, data);
      setStatus("saved");
      setMessage(`Saved to GitHub (${config.repo}/data/expenses.json).`);
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Save failed");
    }
  };

  return (
    <section className="card github-sync-card">
      <div className="card-header">
        <h2>Save data in GitHub</h2>
        {configured && status === "saved" && (
          <span className="badge">Synced</span>
        )}
      </div>
      <div className="card-body form-grid">
        <p className="hint">
          Store all bills in your GitHub repo as{" "}
          <code>data/expenses.json</code>. Use a{" "}
          <a
            href="https://github.com/settings/tokens"
            target="_blank"
            rel="noreferrer"
          >
            Personal Access Token
          </a>{" "}
          with <strong>Contents</strong> read &amp; write for this repo. Token
          stays in your browser only.
        </p>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => updateConfig({ enabled: e.target.checked })}
          />
          Enable GitHub sync
        </label>

        <div className="form-row two-col">
          <div>
            <label htmlFor="ghOwner">GitHub username</label>
            <input
              id="ghOwner"
              value={config.owner}
              onChange={(e) => updateConfig({ owner: e.target.value })}
              placeholder="mnafeel"
            />
          </div>
          <div>
            <label htmlFor="ghRepo">Repository name</label>
            <input
              id="ghRepo"
              value={config.repo}
              onChange={(e) => updateConfig({ repo: e.target.value })}
              placeholder="shop-expense-tracker-"
            />
          </div>
        </div>

        <div>
          <label htmlFor="ghToken">GitHub token</label>
          <input
            id="ghToken"
            type="password"
            value={config.token}
            onChange={(e) => updateConfig({ token: e.target.value })}
            placeholder="ghp_..."
            autoComplete="off"
          />
        </div>

        <div className="github-sync-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleLoad}
            disabled={!configured || status === "loading"}
          >
            Load from GitHub
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!configured || status === "saving"}
          >
            Save to GitHub
          </button>
        </div>

        {status === "loading" && <p className="sync-msg">Loading…</p>}
        {status === "saving" && <p className="sync-msg">Saving to GitHub…</p>}
        {message && (
          <p className={`sync-msg ${status === "error" ? "sync-error" : "sync-ok"}`}>
            {message}
          </p>
        )}
      </div>
    </section>
  );
}

export async function autoLoadGithub(config: GithubConfig): Promise<AppData | null> {
  if (!isGithubConfigured(config)) return null;
  clearGithubCache();
  return syncFromGithub(config);
}

export async function autoSaveGithub(
  config: GithubConfig,
  data: AppData
): Promise<void> {
  if (!isGithubConfigured(config)) return;
  await syncToGithub(config, data);
}
