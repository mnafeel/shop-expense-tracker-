import type { AppData } from "./types";
import type { GithubConfig } from "./githubConfig";
import { defaultData, saveData } from "./storage";

const DATA_PATH = "data/expenses.json";

interface GithubFileResponse {
  content: string;
  sha: string;
}

let cachedSha: string | undefined;

function authHeaders(token: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function decodeContent(content: string): string {
  return decodeURIComponent(
    atob(content.replace(/\n/g, ""))
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
}

function encodeContent(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}

function apiUrl(config: GithubConfig): string {
  return `https://api.github.com/repos/${config.owner.trim()}/${config.repo.trim()}/contents/${DATA_PATH}`;
}

function githubErrorMessage(status: number, body: string): string {
  try {
    const err = JSON.parse(body) as { message?: string };
    const msg = err.message ?? "";
    if (
      status === 403 &&
      msg.toLowerCase().includes("personal access token")
    ) {
      return (
        "Token cannot write to this repo. Use a classic token with the " +
        "repo scope, or a fine-grained token with this repo selected and " +
        "Contents set to Read and write."
      );
    }
    if (status === 404) {
      return "Repo not found. Check username and repo name (shop-expense-tracker-).";
    }
    if (msg) return msg;
  } catch {
    /* use fallback */
  }
  return body || `GitHub request failed (${status})`;
}

export async function loadFromGithub(config: GithubConfig): Promise<AppData> {
  const res = await fetch(apiUrl(config), {
    headers: authHeaders(config.token.trim()),
  });

  if (res.status === 404) {
    cachedSha = undefined;
    return { ...defaultData };
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(githubErrorMessage(res.status, err));
  }

  const file = (await res.json()) as GithubFileResponse;
  cachedSha = file.sha;
  const parsed = JSON.parse(decodeContent(file.content)) as AppData;
  return {
    itemBills: parsed.itemBills ?? [],
    labour: parsed.labour ?? [],
  };
}

export async function saveToGithub(
  config: GithubConfig,
  data: AppData
): Promise<void> {
  const body: Record<string, string> = {
    message: `Update expenses ${new Date().toISOString()}`,
    content: encodeContent(JSON.stringify(data, null, 2)),
  };

  if (cachedSha) {
    body.sha = cachedSha;
  }

  const res = await fetch(apiUrl(config), {
    method: "PUT",
    headers: {
      ...authHeaders(config.token.trim()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(githubErrorMessage(res.status, err));
  }

  const result = (await res.json()) as { content: GithubFileResponse };
  cachedSha = result.content?.sha ?? cachedSha;
}

export async function syncFromGithub(
  config: GithubConfig
): Promise<AppData> {
  const data = await loadFromGithub(config);
  saveData(data);
  return data;
}

export async function syncToGithub(
  config: GithubConfig,
  data: AppData
): Promise<void> {
  saveData(data);
  await saveToGithub(config, data);
}

export function clearGithubCache(): void {
  cachedSha = undefined;
}
