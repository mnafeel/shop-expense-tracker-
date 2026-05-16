import { useEffect, useState } from "react";
import type { AppData } from "./types";
import {
  cloudLabel,
  isCloudConnected,
  loadCloudConfig,
  saveCloudConfig,
  type CloudConfig,
  type CloudProvider,
} from "./cloudConfig";
import { loadFromCloud, saveToCloud } from "./cloudSync";

type SyncStatus = "local" | "loading" | "saving" | "saved" | "error";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token?: string;
              expires_in?: number;
              error?: string;
              error_description?: string;
            }) => void;
            error_callback?: (err: { type: string; message?: string }) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
        };
      };
    };
  }
}

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google sign-in"));
    document.head.appendChild(script);
  });
}

function requestGoogleToken(
  clientId: string
): Promise<{ access_token: string; expires_in: number }> {
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.file",
      error_callback: (err) => {
        reject(
          new Error(
            err.message ||
              `${err.type}. Check Google Cloud setup (origins, test user).`
          )
        );
      },
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(
            new Error(
              response.error_description ||
                response.error ||
                "Google sign-in cancelled"
            )
          );
          return;
        }
        resolve({
          access_token: response.access_token,
          expires_in: response.expires_in ?? 3600,
        });
      },
    });
    client.requestAccessToken({ prompt: "" });
  });
}

export function CloudBackup({
  data,
  syncStatus,
  onConfigChange,
  onDataLoaded,
}: {
  data: AppData;
  syncStatus: SyncStatus;
  onConfigChange: (config: CloudConfig) => void;
  onDataLoaded: (data: AppData) => void;
}) {
  const [config, setConfig] = useState<CloudConfig>(loadCloudConfig);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const connected = isCloudConnected(config);

  useEffect(() => {
    if (!connected && !localStorage.getItem("shop-expense-cloud-dismissed")) {
      setOpen(true);
    }
  }, [connected]);

  const applyConfig = (next: CloudConfig) => {
    setConfig(next);
    saveCloudConfig(next);
    onConfigChange(next);
  };

  const connectGithub = async () => {
    if (!config.githubToken.trim()) {
      setMessage("Paste your GitHub token first.");
      return;
    }
    const next: CloudConfig = {
      ...config,
      provider: "github",
      connected: true,
    };
    applyConfig(next);
    setBusy(true);
    try {
      await saveToCloud(next, data);
      setMessage("Connected. All data auto-saves to GitHub.");
      setOpen(false);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save to GitHub");
    } finally {
      setBusy(false);
    }
  };

  const connectGoogle = async () => {
    if (!GOOGLE_CLIENT_ID) {
      setMessage(
        "Google Drive needs VITE_GOOGLE_CLIENT_ID when building the app."
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await loadGoogleScript();
      const token = await requestGoogleToken(GOOGLE_CLIENT_ID);
      const next: CloudConfig = {
        ...config,
        provider: "google",
        connected: true,
        googleAccessToken: token.access_token,
        googleTokenExpiry: Date.now() + token.expires_in * 1000,
      };
      applyConfig(next);
      await saveToCloud(next, data);
      setMessage("Connected. All data auto-saves to Google Drive.");
      setOpen(false);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => {
    applyConfig({ ...config, connected: false });
    setMessage("");
  };

  const pullFromCloud = async () => {
    if (!connected) return;
    setBusy(true);
    setMessage("");
    try {
      const loaded = await loadFromCloud(config);
      onDataLoaded(loaded);
      setMessage(`Loaded from ${cloudLabel(config)}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Load failed");
    } finally {
      setBusy(false);
    }
  };

  const statusText = () => {
    if (!connected) return "Local only";
    if (syncStatus === "loading") return `Loading ${cloudLabel(config)}…`;
    if (syncStatus === "saving") return `Saving to ${cloudLabel(config)}…`;
    if (syncStatus === "saved") return `Saved to ${cloudLabel(config)}`;
    if (syncStatus === "error") return "Save failed";
    return `Auto-save: ${cloudLabel(config)}`;
  };

  return (
    <>
      <button
        type="button"
        className={`cloud-status-btn ${connected ? "connected" : ""}`}
        onClick={() => setOpen(true)}
        title="Cloud backup settings"
      >
        <span className="cloud-dot" aria-hidden />
        {statusText()}
      </button>

      {open && (
        <div className="cloud-modal-backdrop" onClick={() => setOpen(false)}>
          <section
            className="cloud-modal card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="cloud-modal-title"
          >
            <div className="card-header">
              <h2 id="cloud-modal-title">Auto-save to cloud</h2>
              <button
                type="button"
                className="btn-ghost btn-xs"
                onClick={() => {
                  localStorage.setItem("shop-expense-cloud-dismissed", "1");
                  setOpen(false);
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="card-body form-grid">
              <p className="hint">
                Connect once. Every item and labour entry you add will
                automatically save to GitHub or Google Drive — no extra Save
                button needed.
              </p>

              <div className="cloud-provider-tabs">
                {(["github", "google"] as CloudProvider[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`tab ${config.provider === p ? "active" : ""}`}
                    onClick={() => applyConfig({ ...config, provider: p })}
                  >
                    {p === "github" ? "GitHub" : "Google Drive"}
                  </button>
                ))}
              </div>

              {config.provider === "github" && (
                <>
                  <p className="hint">
                    Data file: <code>data/expenses.json</code> in your repo.
                    Create a{" "}
                    <a
                      href="https://github.com/settings/tokens"
                      target="_blank"
                      rel="noreferrer"
                    >
                      token
                    </a>
                    . Classic: check <strong>repo</strong>. Fine-grained: select
                    this repo only, <strong>Contents → Read and write</strong>.
                  </p>
                  <div className="form-row two-col">
                    <div>
                      <label htmlFor="ghOwner">Username</label>
                      <input
                        id="ghOwner"
                        value={config.githubOwner}
                        onChange={(e) =>
                          applyConfig({ ...config, githubOwner: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label htmlFor="ghRepo">Repository</label>
                      <input
                        id="ghRepo"
                        value={config.githubRepo}
                        onChange={(e) =>
                          applyConfig({ ...config, githubRepo: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="ghToken">GitHub token</label>
                    <input
                      id="ghToken"
                      type="password"
                      value={config.githubToken}
                      onChange={(e) =>
                        applyConfig({ ...config, githubToken: e.target.value })
                      }
                      placeholder="ghp_..."
                      autoComplete="off"
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={connectGithub}
                    disabled={busy}
                  >
                    Connect GitHub
                  </button>
                </>
              )}

              {config.provider === "google" && (
                <>
                  <p className="hint">
                    Saves <code>shop-expenses.json</code> in your Google Drive.
                    Sign in once; updates happen automatically when you add
                    data.
                  </p>
                  <details className="google-setup-details">
                    <summary>If you see “Access blocked”</summary>
                    <ol className="hint google-setup-list">
                      <li>
                        <a
                          href="https://console.cloud.google.com/apis/credentials"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Credentials
                        </a>
                        : open your OAuth client → <strong>Authorized
                        JavaScript origins</strong> must include exactly{" "}
                        <code>https://mnafeel.github.io</code>
                      </li>
                      <li>
                        <a
                          href="https://console.cloud.google.com/apis/credentials/consent"
                          target="_blank"
                          rel="noreferrer"
                        >
                          OAuth consent screen
                        </a>
                        : <strong>Authorized domains</strong> → add{" "}
                        <code>github.io</code>
                      </li>
                      <li>
                        Same screen: if status is <strong>Testing</strong>, add
                        your Gmail under <strong>Test users</strong>
                      </li>
                      <li>
                        Enable{" "}
                        <a
                          href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Google Drive API
                        </a>{" "}
                        and add scope <code>drive.file</code> on the consent
                        screen
                      </li>
                      <li>
                        Use Chrome/Safari (not an in-app browser). Click
                        “Error details” on Google’s page for the exact code.
                      </li>
                    </ol>
                  </details>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={connectGoogle}
                    disabled={busy || !GOOGLE_CLIENT_ID}
                  >
                    {busy ? "Signing in…" : "Sign in with Google"}
                  </button>
                  {!GOOGLE_CLIENT_ID && (
                    <p className="hint sync-error">
                      Google client ID not set for this build.
                    </p>
                  )}
                </>
              )}

              {connected && (
                <div className="cloud-connected-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={pullFromCloud}
                    disabled={busy}
                  >
                    Load from cloud
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
                    message.includes("fail") || message.includes("needs")
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
