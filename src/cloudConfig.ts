export type CloudProvider = "github" | "google";

export interface CloudConfig {
  provider: CloudProvider;
  connected: boolean;
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  googleAccessToken: string;
  googleTokenExpiry: number;
}

const CONFIG_KEY = "shop-expense-cloud-config";
const LEGACY_KEY = "shop-expense-github-config";

export const DEFAULT_CLOUD_CONFIG: CloudConfig = {
  provider: "github",
  connected: false,
  githubToken: "",
  githubOwner: "mnafeel",
  githubRepo: "shop-expense-tracker-",
  googleAccessToken: "",
  googleTokenExpiry: 0,
};

export function loadCloudConfig(): CloudConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) {
      return { ...DEFAULT_CLOUD_CONFIG, ...JSON.parse(raw) };
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy) as {
        enabled?: boolean;
        token?: string;
        owner?: string;
        repo?: string;
      };
      return {
        ...DEFAULT_CLOUD_CONFIG,
        connected: Boolean(old.enabled && old.token?.trim()),
        githubToken: old.token ?? "",
        githubOwner: old.owner ?? DEFAULT_CLOUD_CONFIG.githubOwner,
        githubRepo: old.repo ?? DEFAULT_CLOUD_CONFIG.githubRepo,
      };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_CLOUD_CONFIG };
}

export function saveCloudConfig(config: CloudConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function isCloudConnected(config: CloudConfig): boolean {
  if (!config.connected) return false;
  if (config.provider === "github") {
    return Boolean(
      config.githubToken.trim() &&
        config.githubOwner.trim() &&
        config.githubRepo.trim()
    );
  }
  return Boolean(
    config.googleAccessToken.trim() &&
      config.googleTokenExpiry > Date.now()
  );
}

export function cloudLabel(config: CloudConfig): string {
  return config.provider === "github" ? "GitHub" : "Google Drive";
}
