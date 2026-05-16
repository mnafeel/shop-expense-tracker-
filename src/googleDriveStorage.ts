import type { AppData } from "./types";
import { defaultData } from "./storage";

const FILE_NAME = "shop-expenses.json";
const MIME = "application/json";

let cachedFileId: string | undefined;

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function findFileId(token: string): Promise<string | undefined> {
  const q = encodeURIComponent(
    `name='${FILE_NAME}' and trashed=false`
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&pageSize=1`,
    { headers: authHeaders(token) }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Drive search failed (${res.status})`);
  }
  const data = (await res.json()) as { files?: { id: string }[] };
  return data.files?.[0]?.id;
}

export async function loadFromGoogleDrive(token: string): Promise<AppData> {
  const fileId = await findFileId(token);
  if (!fileId) {
    cachedFileId = undefined;
    return { ...defaultData };
  }
  cachedFileId = fileId;

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: authHeaders(token) }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Drive load failed (${res.status})`);
  }
  const parsed = (await res.json()) as AppData;
  return {
    itemBills: parsed.itemBills ?? [],
    labour: parsed.labour ?? [],
  };
}

export async function saveToGoogleDrive(
  token: string,
  data: AppData
): Promise<void> {
  const body = JSON.stringify(data, null, 2);
  const blob = new Blob([body], { type: MIME });

  if (cachedFileId) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${cachedFileId}?uploadType=media`,
      {
        method: "PATCH",
        headers: { ...authHeaders(token), "Content-Type": MIME },
        body,
      }
    );
    if (!res.ok) {
      if (res.status === 404) {
        cachedFileId = undefined;
        return saveToGoogleDrive(token, data);
      }
      const err = await res.text();
      throw new Error(err || `Drive save failed (${res.status})`);
    }
    return;
  }

  const fileId = await findFileId(token);
  if (fileId) {
    cachedFileId = fileId;
    return saveToGoogleDrive(token, data);
  }

  const metadata = { name: FILE_NAME, mimeType: MIME };
  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  form.append("file", blob);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: authHeaders(token),
      body: form,
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Drive create failed (${res.status})`);
  }
  const created = (await res.json()) as { id: string };
  cachedFileId = created.id;
}

export function clearGoogleDriveCache(): void {
  cachedFileId = undefined;
}
