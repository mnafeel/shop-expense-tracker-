import { useMemo, useRef, useState } from "react";
import type { AppData } from "./types";
import { dataToText, ensureIds, textToData } from "./textBackup";
import { saveData } from "./storage";

export function TextBackupPanel({
  data,
  savedAt,
  onImport,
}: {
  data: AppData;
  savedAt: number;
  onImport: (data: AppData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState("");
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const text = useMemo(() => dataToText(data), [data, savedAt]);

  const showMsg = (msg: string, ok = true) => {
    setMessage(msg);
    window.setTimeout(() => setMessage(""), 4000);
    if (!ok) return;
  };

  const copyBackup = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    showMsg("Copied! Paste on your other device → Import backup.");
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
    showMsg("File downloaded. Open it on another device and import.");
  };

  const shareBackup = async () => {
    const file = new File(
      [text],
      `expenses-${new Date().toISOString().slice(0, 10)}.txt`,
      { type: "text/plain" }
    );
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: "Shop expense backup",
        text: "Expense tracker backup",
        files: [file],
      });
      showMsg("Shared. Open the file on your other device.");
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: "Shop expense backup", text });
      showMsg("Shared. Paste on other device → Import backup.");
      return;
    }
    await copyBackup();
  };

  const applyImport = (raw: string) => {
    if (!raw.trim()) {
      showMsg("Paste backup text or choose a .txt file first.", false);
      return;
    }
    try {
      const imported = ensureIds(textToData(raw));
      saveData(imported);
      onImport(imported);
      setImportText("");
      showMsg("Backup imported. All your items and labour are restored.");
    } catch {
      showMsg("Could not read backup. Use a file from this app.", false);
    }
  };

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? "");
      setImportText(content);
      applyImport(content);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <>
      <button
        type="button"
        className="text-backup-btn synced"
        onClick={() => setOpen(true)}
        title="Backup and use on all devices"
      >
        <span className="text-backup-dot" aria-hidden />
        Backup · all devices
      </button>

      {open && (
        <div
          className="text-backup-backdrop"
          onClick={() => setOpen(false)}
        >
          <section
            className="text-backup-modal card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="text-backup-title"
          >
            <div className="card-header">
              <h2 id="text-backup-title">Backup · all devices</h2>
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
              <div className="all-devices-steps">
                <p className="hint steps-title">
                  <strong>See the same data on phone, laptop, tablet:</strong>
                </p>
                <ol className="hint steps-list">
                  <li>
                    On this device: <strong>Copy</strong>, <strong>Share</strong>
                    , or <strong>Download</strong> the backup below.
                  </li>
                  <li>
                    Send it to the other device (WhatsApp, email, Google Drive,
                    iCloud, etc.).
                  </li>
                  <li>
                    On the other device: open this app → tap{" "}
                    <strong>Backup · all devices</strong> → paste or upload →{" "}
                    <strong>Import backup</strong>.
                  </li>
                </ol>
                <p className="hint">
                  Data also auto-saves as text on each device you use. Import
                  the newest backup when you switch devices.
                </p>
              </div>

              <div className="text-backup-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={copyBackup}
                >
                  {copied ? "Copied" : "Copy backup"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={shareBackup}
                >
                  Share
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={downloadBackup}
                >
                  Download .txt
                </button>
              </div>

              <hr className="backup-divider" />

              <p className="hint">
                <strong>Import on this device</strong> (from another phone or
                computer):
              </p>
              <textarea
                className="text-backup-preview"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste backup text here…"
                rows={6}
                aria-label="Paste backup to import"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,text/plain"
                hidden
                onChange={onFilePicked}
              />
              <div className="text-backup-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => applyImport(importText)}
                >
                  Import backup
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload .txt file
                </button>
              </div>

              <hr className="backup-divider" />

              <p className="hint">Current backup preview:</p>
              <textarea
                className="text-backup-preview"
                readOnly
                value={text}
                rows={8}
                aria-label="Current backup preview"
              />

              {message && (
                <p
                  className={`sync-msg ${
                    message.includes("Could not") ||
                    message.includes("Paste backup")
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
