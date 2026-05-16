import { useMemo, useState } from "react";
import { dataToText } from "./textBackup";
import type { AppData } from "./types";

export function TextBackupPanel({
  data,
  savedAt,
}: {
  data: AppData;
  savedAt: number;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const text = useMemo(() => dataToText(data), [data, savedAt]);

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
        className="text-backup-btn synced"
        onClick={() => setOpen(true)}
        title="View text backup"
      >
        <span className="text-backup-dot" aria-hidden />
        Text backup saved
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
              <h2 id="text-backup-title">Text backup</h2>
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
                Every item and labour entry is saved here automatically as plain
                text on this device.
              </p>
              <textarea
                className="text-backup-preview"
                readOnly
                value={text}
                rows={14}
                aria-label="Backup text"
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
                  className="btn btn-primary"
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
