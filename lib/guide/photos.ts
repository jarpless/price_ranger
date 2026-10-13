import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { dataBackend } from "../env";
import { createClient } from "../supabase/server";

const root = path.join(process.cwd(), "data", "guide-photos");

export interface PhotoBytes {
  bytes: Uint8Array;
  mime: string;
}

function sniff(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "image/gif";
  if (bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49) return "image/webp";
  return "image/jpeg";
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

function diskPath(userId: string, name: string): string {
  return path.join(root, safeId(userId), name);
}

async function writeDisk(userId: string, name: string, bytes: Uint8Array): Promise<void> {
  const file = diskPath(userId, name);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
}

async function readDisk(userId: string, name: string): Promise<PhotoBytes | null> {
  try {
    const bytes = new Uint8Array(await readFile(diskPath(userId, name)));
    if (bytes.length < 32) return null;
    return { bytes, mime: sniff(bytes) };
  } catch {
    return null;
  }
}

function storagePath(userId: string, name: string): string {
  return `${userId}/price-photos/${name}`;
}

async function writeStorage(userId: string, name: string, bytes: Uint8Array, mime: string): Promise<void> {
  if (dataBackend() !== "supabase") return;
  const supabase = await createClient();
  await supabase.storage.from("feedback").upload(storagePath(userId, name), Buffer.from(bytes), {
    upsert: true,
    contentType: mime,
  });
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
  await writeStorage(userId, "pending", bytes, mime).catch(() => undefined);
}

export async function readPendingPhoto(userId: string): Promise<PhotoBytes | null> {
  return (await readDisk(userId, "pending")) || (await readStorage(userId, "pending"));
}

export async function saveQuotePhoto(userId: string, quoteId: string, bytes: Uint8Array, mime: string): Promise<void> {
  const name = safeId(quoteId);
  await writeDisk(userId, name, bytes);
  await writeStorage(userId, name, bytes, mime).catch(() => undefined);
  await writeDisk(userId, "pending", new Uint8Array()).catch(() => undefined);
}

export async function readQuotePhoto(userId: string, quoteId: string): Promise<PhotoBytes | null> {
  return (await readDisk(userId, safeId(quoteId))) || (await readStorage(userId, safeId(quoteId)));
}

export function photoDataUrl(photo: PhotoBytes, maxBytes = 1_500_000): string | null {
  if (photo.bytes.length > maxBytes) return null;
  return `data:${photo.mime};base64,${Buffer.from(photo.bytes).toString("base64")}`;
}
