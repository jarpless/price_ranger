import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { dataBackend } from "../env";
import { createClient } from "../supabase/server";

/**
 * Vercel can run the app from a read-only directory. A throw from that write became
 * the production HTTP 500 on photo upload. Disk is best-effort; /tmp is the fallback;
 * Supabase storage is the copy that survives the next instance.
 */
const MAX_PHOTO_BYTES = 3_500_000;

export interface PhotoBytes {
  bytes: Uint8Array;
  mime: string;
}

export type PhotoIssue = "heic" | "large" | "unreadable";

function roots(): string[] {
  const primary = process.env.GUIDE_PHOTO_DIR || path.join(process.cwd(), "data", "guide-photos");
  const tmp = path.join(os.tmpdir(), "price-ranger-photos");
  return primary === tmp ? [primary] : [primary, tmp];
}

function brand(bytes: Uint8Array): string {
  if (bytes.length < 16) return "";
  return Buffer.from(bytes.slice(4, 16)).toString("ascii").toLowerCase();
}

export function sniffKind(bytes: Uint8Array, mime = ""): "jpeg" | "png" | "gif" | "webp" | "heic" | "unknown" {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "gif";
  if (bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return "webp";
  const tag = brand(bytes);
  if (tag.includes("ftyp") && /heic|heif|heix|mif1|msf1|hevc/.test(tag)) return "heic";
  if (/heic|heif/i.test(mime)) return "heic";
  return "unknown";
}

export function mimeFor(bytes: Uint8Array, hinted = ""): string {
  const kind = sniffKind(bytes, hinted);
  if (kind === "jpeg") return "image/jpeg";
  if (kind === "png") return "image/png";
  if (kind === "gif") return "image/gif";
  if (kind === "webp") return "image/webp";
  if (kind === "heic") return "image/heic";
  return hinted.startsWith("image/") ? hinted : "application/octet-stream";
}

/** Why a photo cannot be priced. Null means the bytes are a normal image we can send to vision. */
export function inspectPhoto(bytes: Uint8Array, mime = ""): PhotoIssue | null {
  const kind = sniffKind(bytes, mime);
  if (kind === "heic") return "heic";
  if (bytes.length > MAX_PHOTO_BYTES) return "large";
  if (kind === "unknown") return "unreadable";
  return null;
}

function sniff(bytes: Uint8Array): string {
  return mimeFor(bytes);
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

async function writeDisk(userId: string, name: string, bytes: Uint8Array): Promise<boolean> {
  const id = safeId(userId);
  for (const root of roots()) {
    try {
      const file = path.join(root, id, name);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, bytes);
      return true;
    } catch {
      // The app directory is read-only on Vercel. Try the next root.
    }
  }
  return false;
}

async function readDisk(userId: string, name: string): Promise<PhotoBytes | null> {
  const id = safeId(userId);
  for (const root of roots()) {
    try {
      const bytes = new Uint8Array(await readFile(path.join(root, id, name)));
      if (bytes.length < 32) continue;
      return { bytes, mime: sniff(bytes) };
    } catch {
      // Missing on this root.
    }
  }
  return null;
}

function storagePath(userId: string, name: string): string {
  return `${userId}/price-photos/${name}`;
}

async function writeStorage(userId: string, name: string, bytes: Uint8Array, mime: string): Promise<boolean> {
  if (dataBackend() !== "supabase") return false;
  try {
    const supabase = await createClient();
    const { error } = await supabase.storage.from("feedback").upload(storagePath(userId, name), Buffer.from(bytes), {
      upsert: true,
      contentType: mime,
    });
    return !error;
  } catch {
    // Storage is a backup. A failed upload must not become a 500.
    return false;
  }
}

async function readStorage(userId: string, name: string): Promise<PhotoBytes | null> {
  if (dataBackend() !== "supabase") return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.storage.from("feedback").download(storagePath(userId, name));
    if (error || !data) return null;
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (bytes.length < 32) return null;
    return { bytes, mime: data.type || sniff(bytes) };
  } catch {
    return null;
  }
}

export async function savePendingPhoto(userId: string, bytes: Uint8Array, mime: string): Promise<void> {
  await writeDisk(userId, "pending", bytes);
  await writeStorage(userId, "pending", bytes, mime);
}

export async function readPendingPhoto(userId: string): Promise<PhotoBytes | null> {
  return (await readDisk(userId, "pending")) || (await readStorage(userId, "pending"));
}

export async function saveQuotePhoto(userId: string, quoteId: string, bytes: Uint8Array, mime: string): Promise<void> {
  const name = safeId(quoteId);
  await writeDisk(userId, name, bytes);
  await writeStorage(userId, name, bytes, mime);
  await writeDisk(userId, "pending", new Uint8Array());
}

export async function readQuotePhoto(userId: string, quoteId: string): Promise<PhotoBytes | null> {
  return readStoredFile(userId, safeId(quoteId));
}

export function photoDataUrl(photo: PhotoBytes, maxBytes = 1_500_000): string | null {
  if (photo.bytes.length > maxBytes) return null;
  if (!photo.mime.startsWith("image/")) return null;
  return `data:${photo.mime};base64,${Buffer.from(photo.bytes).toString("base64")}`;
}

/** Same `{userId}/price-photos/` object the single quote photo already uses. */
export async function writeStoredFile(userId: string, name: string, bytes: Uint8Array, mime: string): Promise<boolean> {
  const disk = await writeDisk(userId, name, bytes);
  const stored = await writeStorage(userId, name, bytes, mime);
  return disk || stored;
}

async function serviceStorage() {
  if (dataBackend() !== "supabase") return null;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return null;
  const { createClient: createService } = await import("@supabase/supabase-js");
  return createService(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function readServiceStorage(userId: string, name: string): Promise<PhotoBytes | null> {
  try {
    const service = await serviceStorage();
    if (!service) return null;
    const { data, error } = await service.storage.from("feedback").download(storagePath(userId, name));
    if (error || !data) return null;
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (bytes.length < 32) return null;
    return { bytes, mime: data.type || sniff(bytes) };
  } catch {
    return null;
  }
}

async function diskBytes(userId: string, name: string): Promise<number | null> {
  const id = safeId(userId);
  for (const root of roots()) {
    try {
      const info = await stat(path.join(root, id, name));
      if (info.isFile() && info.size >= 32) return info.size;
    } catch {
      // Missing on this root.
    }
  }
  return null;
}

/**
 * Byte size of a stored object, without downloading it.
 * Disk first. On Supabase, `info` under the existing read policy.
 */
export async function storedObjectBytes(userId: string, name: string): Promise<number | null> {
  const disk = await diskBytes(userId, name);
  if (disk != null) return disk;
  if (dataBackend() !== "supabase") return null;
  const objectPath = storagePath(userId, name);
  const clients = [];
  try {
    clients.push(await createClient());
  } catch {
    // No user session to ask.
  }
  const service = await serviceStorage();
  if (service) clients.push(service);
  for (const client of clients) {
    try {
      const { data, error } = await client.storage.from("feedback").info(objectPath);
      if (!error && typeof data?.size === "number" && data.size >= 32) return data.size;
    } catch {
      // Try the next client. Never log the path or the error body.
    }
  }
  return null;
}

/**
 * Signed upload URL for `{userId}/price-photos/{name}` in the existing feedback bucket.
 * The user session is first (insert policy). The service role is only a server-side fallback.
 * Returns null when this process is not on Supabase.
 */
export async function signedPricePhotoUpload(userId: string, name: string): Promise<{ url: string } | null> {
  if (dataBackend() !== "supabase") return null;
  const objectPath = storagePath(userId, name);
  const clients = [];
  try {
    clients.push(await createClient());
  } catch {
    // Fall through to the service role.
  }
  const service = await serviceStorage();
  if (service) clients.push(service);
  for (const client of clients) {
    try {
      const { data, error } = await client.storage.from("feedback").createSignedUploadUrl(objectPath, { upsert: true });
      if (!error && data?.signedUrl) return { url: data.signedUrl };
    } catch {
      // The next client may be allowed. Do not log the URL.
    }
  }
  return null;
}

/** Disk first, then the signed-in user's object, then the service role for a public share. */
export async function readStoredFile(userId: string, name: string): Promise<PhotoBytes | null> {
  return (await readDisk(userId, name)) || (await readStorage(userId, name)) || (await readServiceStorage(userId, name));
}

async function deleteDisk(userId: string, name: string): Promise<void> {
  const id = safeId(userId);
  for (const root of roots()) {
    try {
      await unlink(path.join(root, id, name));
    } catch {
      // Already gone on this root.
    }
  }
}

async function deleteStorage(userId: string, name: string): Promise<void> {
  if (dataBackend() !== "supabase") return;
  const objectPath = storagePath(userId, name);
  try {
    const supabase = await createClient();
    await supabase.storage.from("feedback").remove([objectPath]);
  } catch {
    // The row can outlive the object.
  }
  try {
    const service = await serviceStorage();
    if (service) await service.storage.from("feedback").remove([objectPath]);
  } catch {
    // Best effort.
  }
}

export async function deleteStoredFile(userId: string, name: string): Promise<void> {
  await deleteDisk(userId, name);
  await deleteStorage(userId, name);
}

export async function deleteQuotePhoto(userId: string, quoteId: string): Promise<void> {
  await deleteStoredFile(userId, safeId(quoteId));
}
