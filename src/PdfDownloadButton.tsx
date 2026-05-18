type PdfDownloadVariant = "header" | "items" | "labour";

export function PdfDownloadButton({
  onClick,
  disabled,
  label,
  variant = "items",
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  variant?: PdfDownloadVariant;
}) {
  return (
    <button
      type="button"
      className={`pdf-download-btn pdf-download-btn--${variant}`}
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "No data to download" : label}
      aria-label={label}
    >
      <DownloadIcon />
    </button>
  );
}

function DownloadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
