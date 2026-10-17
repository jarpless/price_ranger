import { deleteQuotePhoto, deleteStoredFile, inspectPhoto, readQuotePhoto, readStoredFile, writeStoredFile } from "./photos";
import { QUOTE_MEDIA_LIMIT } from "./media-copy";
import {
  albumIndexName,
  classifyUpload,
  isQuoteMediaItem,
  mediaObjectName,
  posterObjectName,
  type MediaError,
  type QuoteMediaItem,
} from "./media-file";

export type { MediaError, QuoteMediaItem } from "./media-file";

let chain: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function newId(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 12);
}

async function readIndex(userId: string, quoteId: string): Promise<QuoteMediaItem[]> {
  const file = await readStoredFile(userId, albumIndexName(quoteId));
  if (!file) return [];
  try {
    const parsed = JSON.parse(Buffer.from(file.bytes).toString("utf8")) as { items?: unknown };
    if (!Array.isArray(parsed.items)) return [];
    return parsed.items.filter(isQuoteMediaItem);
  } catch {
    return [];
  }
}

async function writeIndex(userId: string, quoteId: string, items: QuoteMediaItem[]): Promise<boolean> {
  const body = JSON.stringify({ items, note: "price-ranger quote media" });
  return writeStoredFile(userId, albumIndexName(quoteId), Buffer.from(body), "application/json");
}

async function listUnlocked(userId: string, quoteId: string): Promise<QuoteMediaItem[]> {
  const saved = await readIndex(userId, quoteId);
  const legacy = await readQuotePhoto(userId, quoteId);
  if (!legacy || !legacy.mime.startsWith("image/")) return saved;
  const cover: QuoteMediaItem = {
    id: "cover",
    kind: "image",
    mime: legacy.mime,
    createdAt: saved[0]?.createdAt || "1970-01-01T00:00:00.000Z",
    poster: false,
  };
  return [cover, ...saved];
}

export async function listQuoteMedia(userId: string, quoteId: string): Promise<QuoteMediaItem[]> {
  return withLock(() => listUnlocked(userId, quoteId));
}

async function posterBytes(bytes: Uint8Array | null | undefined): Promise<Uint8Array | null> {
  if (!bytes || bytes.length < 32 || bytes.length > 1_500_000) return null;
  if (inspectPhoto(bytes, "image/jpeg")) return null;
  return bytes;
}

export async function addQuoteMedia(
  userId: string,
  quoteId: string,
  input: { bytes: Uint8Array; hinted?: string; poster?: Uint8Array | null },
): Promise<{ item: QuoteMediaItem } | { error: MediaError }> {
  const classified = classifyUpload(input.bytes, input.hinted || "");
  if ("error" in classified) return classified;
  return withLock(async () => {
    const existing = await listUnlocked(userId, quoteId);
    if (existing.length >= QUOTE_MEDIA_LIMIT) return { error: "limit" };
    const item: QuoteMediaItem = {
      id: newId(),
      kind: classified.kind,
      mime: classified.mime,
      createdAt: new Date().toISOString(),
      poster: false,
    };
    const stored = await writeStoredFile(userId, mediaObjectName(quoteId, item.id), input.bytes, item.mime);
    if (!stored) return { error: "store" };
    if (item.kind === "video") {
      const poster = await posterBytes(input.poster);
      if (poster) {
        const wrote = await writeStoredFile(userId, posterObjectName(quoteId, item.id), poster, "image/jpeg");
        item.poster = wrote;
      }
    }
    const items = existing.filter((entry) => entry.id !== "cover");
    items.push(item);
    const saved = await writeIndex(userId, quoteId, items);
    if (!saved) {
      await deleteStoredFile(userId, mediaObjectName(quoteId, item.id));
      return { error: "store" };
    }
    return { item };
  });
}

export async function removeQuoteMedia(userId: string, quoteId: string, mediaId: string): Promise<boolean> {
  if (mediaId === "cover") {
    await deleteQuotePhoto(userId, quoteId);
    return true;
  }
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(mediaId)) return false;
  return withLock(async () => {
    const items = await readIndex(userId, quoteId);
    if (!items.some((item) => item.id === mediaId)) return false;
    await deleteStoredFile(userId, mediaObjectName(quoteId, mediaId));
    await deleteStoredFile(userId, posterObjectName(quoteId, mediaId));
    await writeIndex(
      userId,
      quoteId,
      items.filter((item) => item.id !== mediaId),
    );
    return true;
  });
}

export async function readQuoteMediaFile(
  userId: string,
  quoteId: string,
  mediaId: string,
  options: { poster?: boolean } = {},
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (options.poster) {
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(mediaId)) return null;
    const poster = await readStoredFile(userId, posterObjectName(quoteId, mediaId));
    if (!poster) return null;
    return { bytes: poster.bytes, mime: "image/jpeg" };
  }
  if (mediaId === "cover") return readQuotePhoto(userId, quoteId);
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(mediaId)) return null;
  const items = await readIndex(userId, quoteId);
  const item = items.find((entry) => entry.id === mediaId);
  if (!item) return null;
  const file = await readStoredFile(userId, mediaObjectName(quoteId, item.id));
  if (!file) return null;
  return { bytes: file.bytes, mime: item.mime };
}
