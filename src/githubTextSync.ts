import type { AppData } from "./types";
import type { GithubConfig } from "./githubConfig";
import { saveData } from "./storage";
import { dataToText, ensureIds, jsonToData, textToData } from "./textBackup";

const TEXT_PATH = "data/expenses.txt";
const LEGACY_JSON = "data/expenses.json";

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

function apiUrl(config: GithubConfig, path: string): string {
  return `https://api.github.com/repos/${config.owner.trim()}/${config.repo.trim()}/contents/${path}`;
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
        "Token cannot write to this repo. Use a classic token with repo scope, " +
        "or fine-grained Contents read & write."
      );
    }
    if (status === 404) {
      return "Repo not found. Check username and repo name.";
    }
    if (msg) return msg;
  } catch {
    /* ignore */
  }
  return body || `GitHub request failed (${status})`;
}

async function fetchFile(
  config: GithubConfig,
  path: string
): Promise<GithubFileResponse | null> {
  const res = await fetch(apiUrl(config, path), {
    headers: authHeaders(config.token.trim()),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(githubErrorMessage(res.status, await res.text()));
  }
  return (await res.json()) as GithubFileResponse;
}

function parseTextFile(file: GithubFileResponse): AppData {
  return ensureIds(textToData(decodeContent(file.content)));
}

function parseJsonFile(file: GithubFileResponse): AppData {
  return ensureIds(jsonToData(decodeContent(file.content)));
}

export async function pullTextFromGithub(config: GithubConfig): Promise<AppData> {
  const textFile = await fetchFile(config, TEXT_PATH);
  if (textFile) {
    cachedSha = textFile.sha;
    const data = parseTextFile(textFile);
    saveData(data);
    return data;
  }

  const jsonFile = await fetchFile(config, LEGACY_JSON);
  if (jsonFile) {
    cachedSha = undefined;
    const data = parseJsonFile(jsonFile);
    saveData(data);
    return data;
  }

  cachedSha = undefined;
  const empty: AppData = { itemBills: [], labour: [] };
  saveData(empty);
  return empty;
}

export async function pushTextToGithub(
  config: GithubConfig,
  data: AppData
): Promise<void> {
  const text = dataToText(data);
  const body: Record<string, string> = {
    message: `Update expense backup ${new Date().toISOString()}`,
    content: encodeContent(text),
  };
  if (cachedSha) body.sha = cachedSha;

  const res = await fetch(apiUrl(config, TEXT_PATH), {
    method: "PUT",
    headers: {
      ...authHeaders(config.token.trim()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(githubErrorMessage(res.status, await res.text()));
  }

  const result = (await res.json()) as { content: GithubFileResponse };
  cachedSha = result.content?.sha ?? cachedSha;
}

export function clearGithubShaCache(): void {
  cachedSha = undefined;
}
