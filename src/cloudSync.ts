import type { AppData } from "./types";
import type { CloudConfig } from "./cloudConfig";
import { isCloudConnected } from "./cloudConfig";
import { clearGithubCache, syncFromGithub, syncToGithub } from "./githubStorage";
import {
  clearGoogleDriveCache,
  loadFromGoogleDrive,
  saveToGoogleDrive,
} from "./googleDriveStorage";
import { saveData } from "./storage";
import type { GithubConfig } from "./githubConfig";

function toGithubConfig(config: CloudConfig): GithubConfig {
  return {
    token: config.githubToken,
    owner: config.githubOwner,
    repo: config.githubRepo,
    enabled: true,
  };
}

export async function loadFromCloud(config: CloudConfig): Promise<AppData> {
  if (!isCloudConnected(config)) {
    throw new Error("Cloud backup not connected");
  }
  if (config.provider === "github") {
    clearGithubCache();
    return syncFromGithub(toGithubConfig(config));
  }
  clearGoogleDriveCache();
  const data = await loadFromGoogleDrive(config.googleAccessToken);
  saveData(data);
  return data;
}

export async function saveToCloud(
  config: CloudConfig,
  data: AppData
): Promise<void> {
  if (!isCloudConnected(config)) return;
  saveData(data);
  if (config.provider === "github") {
    await syncToGithub(toGithubConfig(config), data);
    return;
  }
  await saveToGoogleDrive(config.googleAccessToken, data);
}

export async function autoLoadCloud(
  config: CloudConfig
): Promise<AppData | null> {
  if (!isCloudConnected(config)) return null;
  try {
    return await loadFromCloud(config);
  } catch {
    return null;
  }
}

export async function autoSaveCloud(
  config: CloudConfig,
  data: AppData
): Promise<void> {
  if (!isCloudConnected(config)) return;
  await saveToCloud(config, data);
}
