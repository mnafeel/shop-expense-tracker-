export interface GithubConfig {
  token: string;
  owner: string;
  repo: string;
  connected: boolean;
}

const CONFIG_KEY = "shop-expense-github-sync";

export const DEFAULT_GITHUB_CONFIG: GithubConfig = {
  token: "",
  owner: "mnafeel",
  repo: "shop-expense-tracker-",
  connected: false,
};

export function loadGithubConfig(): GithubConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_GITHUB_CONFIG };
    return { ...DEFAULT_GITHUB_CONFIG, ...JSON.parse(raw) };
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

export function githubFileUrl(config: GithubConfig): string {
  return `https://github.com/${config.owner.trim()}/${config.repo.trim()}/blob/main/data/expenses.txt`;
}
