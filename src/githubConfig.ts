export interface GithubConfig {
  token: string;
  owner: string;
  repo: string;
  connected: boolean;
}

const CONFIG_KEY = "shop-expense-github-config";
const LEGACY_CLOUD_KEY = "shop-expense-cloud-config";

export const DEFAULT_GITHUB_CONFIG: GithubConfig = {
  token: "",
  owner: "mnafeel",
  repo: "shop-expense-tracker-",
  connected: false,
};

export function loadGithubConfig(): GithubConfig {
  try {
    const cloudRaw = localStorage.getItem(LEGACY_CLOUD_KEY);
    if (cloudRaw) {
      const cloud = JSON.parse(cloudRaw) as {
        githubToken?: string;
        githubOwner?: string;
        githubRepo?: string;
        connected?: boolean;
        token?: string;
        owner?: string;
        repo?: string;
        enabled?: boolean;
      };
      return {
        ...DEFAULT_GITHUB_CONFIG,
        token: cloud.githubToken ?? cloud.token ?? "",
        owner: cloud.githubOwner ?? cloud.owner ?? DEFAULT_GITHUB_CONFIG.owner,
        repo: cloud.githubRepo ?? cloud.repo ?? DEFAULT_GITHUB_CONFIG.repo,
        connected: Boolean(cloud.connected ?? cloud.enabled),
      };
    }

    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_GITHUB_CONFIG };
    const parsed = JSON.parse(raw) as Partial<GithubConfig> & { enabled?: boolean };
    return {
      ...DEFAULT_GITHUB_CONFIG,
      ...parsed,
      connected: Boolean(parsed.connected ?? parsed.enabled),
    };
  } catch {
    return { ...DEFAULT_GITHUB_CONFIG };
  }
}

export function saveGithubConfig(config: GithubConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function isGithubConnected(config: GithubConfig): boolean {
  return Boolean(
    config.connected &&
      config.token.trim() &&
      config.owner.trim() &&
      config.repo.trim()
  );
}
