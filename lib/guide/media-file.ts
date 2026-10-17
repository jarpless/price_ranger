import { inspectPhoto, mimeFor, sniffKind } from "./photos";
import { MAX_VIDEO_BYTES } from "./media-copy";

export type MediaKind = "image" | "video";

export interface QuoteMediaItem {
  id: string;
  kind: MediaKind;
  mime: string;
  createdAt: string;
  poster: boolean;
}

export type MediaError =
  | "heic"
  | "large"
  | "unreadable"
  | "video-large"
  | "unsupported"
  | "limit"
  | "store";

const ID = /^[a-zA-Z0-9_-]{1,40}$/;

export function isMediaId(value: string): boolean {
  return value === "cover" || ID.test(value);
}

function part(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

/** Object name under the existing `{userId}/price-photos/` prefix. */
export function mediaObjectName(quoteId: string, mediaId: string): string {
  return `album-${part(quoteId)}-${part(mediaId)}`;
}

export function posterObjectName(quoteId: string, mediaId: string): string {
  return `${mediaObjectName(quoteId, mediaId)}-poster`;
}

export function albumIndexName(quoteId: string): string {
  return `album-${part(quoteId)}-index`;
}

function videoMime(bytes: Uint8Array): string | null {
  if (bytes.length > 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return "video/webm";
  }
  if (bytes.length < 12) return null;
  const box = Buffer.from(bytes.subarray(4, 8)).toString("ascii");
  if (box !== "ftyp") return null;
  const brand = Buffer.from(bytes.subarray(8, 12)).toString("ascii").toLowerCase();
  if (brand.startsWith("qt")) return "video/quicktime";
  if (/^(mp4|isom|iso2|avc1|mp41|mp42|m4v|dash)/.test(brand)) return "video/mp4";
  return null;
}

export function classifyUpload(
  bytes: Uint8Array,
  hinted = "",
): { kind: MediaKind; mime: string } | { error: MediaError } {
  const kind = sniffKind(bytes, hinted);
  if (kind === "heic") return { error: "heic" };
  if (kind === "jpeg" || kind === "png" || kind === "gif" || kind === "webp") {
    const issue = inspectPhoto(bytes, hinted);
    if (issue === "large") return { error: "large" };
    if (issue) return { error: "unreadable" };
    return { kind: "image", mime: mimeFor(bytes, hinted) };
  }
  const video = videoMime(bytes);
  if (video) {
    if (bytes.length > MAX_VIDEO_BYTES) return { error: "video-large" };
    return { kind: "video", mime: video };
  }
  if (bytes.length > MAX_VIDEO_BYTES && hinted.startsWith("video/")) return { error: "video-large" };
  return { error: "unsupported" };
}

export function isQuoteMediaItem(value: unknown): value is QuoteMediaItem {
  if (!value || typeof value !== "object") return false;
  const row = value as QuoteMediaItem;
  return (
    ID.test(row.id) &&
    (row.kind === "image" || row.kind === "video") &&
    typeof row.mime === "string" &&
    row.mime.length < 80 &&
    typeof row.createdAt === "string" &&
    typeof row.poster === "boolean"
  );
}
