import { getSessionUser } from "../auth";
import { dataBackend } from "../env";
import { getData } from "../store";
import { MAX_DIRECT_VIDEO_BYTES, QUOTE_MEDIA_LIMIT } from "./media-copy";
import { classifyUpload, mediaObjectName, type MediaError } from "./media-file";
import { commitUploadedMedia, listQuoteMedia, type QuoteMediaItem } from "./media";
import { issueDirectTicket, readDirectTicket } from "./media-ticket";
import { signedPricePhotoUpload, storedObjectBytes, writeStoredFile } from "./photos";

/**
 * Longer clips go straight to the existing private `feedback` bucket
 * (`{userId}/price-photos/…`) via createSignedUploadUrl.
 *
 * Minting the URL needs INSERT on storage.objects. The policy
 * "own feedback objects write" already allows that when the first folder
 * is auth.uid(). The browser PUT uses the token and needs no extra policy.
 * Completion reads the size with storage.info, which the existing
 * "own feedback objects read" select policy already allows.
 *
 * Nothing here changes the bucket, its file-size limit, or those policies.
 * If a project's file-size limit is under 50MB, the PUT fails and the
 * screen asks for a shorter clip.
 *
 * Local dev has no bucket. It uses a short-lived HMAC ticket and a
 * same-origin PUT. That ticket is not a Supabase signed URL.
 */

const HEAD_BYTES = 64;

export async function quoteOwner(quoteId: string): Promise<{ id: string } | { status: number; error: string }> {
  const user = await getSessionUser();
  if (!user) return { status: 401, error: "signin" };
  const quote = await (await getData()).getQuote(user.id, quoteId);
  if (!quote) return { status: 404, error: "missing" };
  return { id: user.id };
}

export function decodeMediaHead(value: unknown): Uint8Array | null {
  if (typeof value !== "string" || value.length < 16 || value.length > 128) return null;
  const bytes = Buffer.from(value, "base64");
  if (bytes.length < 12 || bytes.length > HEAD_BYTES) return null;
  return new Uint8Array(bytes);
}

export async function prepareDirectVideo(
  userId: string,
  quoteId: string,
  input: { mime: string; bytes: number; head: Uint8Array },
): Promise<
  | { id: string; mime: string; ticket: string; signedUrl: string | null }
  | { error: MediaError }
> {
  if (!Number.isInteger(input.bytes) || input.bytes < 32) return { error: "unsupported" };
  if (input.bytes > MAX_DIRECT_VIDEO_BYTES) return { error: "video-large" };
  const classified = classifyUpload(input.head.subarray(0, HEAD_BYTES), input.mime, {
    maxVideoBytes: MAX_DIRECT_VIDEO_BYTES,
    byteLength: input.bytes,
  });
  if ("error" in classified) return classified;
  if (classified.kind !== "video") return { error: "unsupported" };
  const existing = await listQuoteMedia(userId, quoteId);
  if (existing.length >= QUOTE_MEDIA_LIMIT) return { error: "limit" };
  const id = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const name = mediaObjectName(quoteId, id);
  const ticket = issueDirectTicket({
    userId,
    quoteId,
    mediaId: id,
    name,
    mime: classified.mime,
    bytes: input.bytes,
  });
  const signed = await signedPricePhotoUpload(userId, name);
  if (dataBackend() === "supabase" && !signed) return { error: "store" };
  return { id, mime: classified.mime, ticket, signedUrl: signed?.url ?? null };
}

/** Local and dev uploads. Production clips PUT to the signed storage URL instead. */
export async function acceptDirectBytes(
  userId: string,
  quoteId: string,
  ticket: string,
  bytes: Uint8Array,
): Promise<{ ok: true } | { error: MediaError }> {
  const claim = readDirectTicket(ticket);
  if (!claim || claim.userId !== userId || claim.quoteId !== quoteId) return { error: "unsupported" };
  if (bytes.length !== claim.bytes || bytes.length > MAX_DIRECT_VIDEO_BYTES) return { error: "unsupported" };
  const classified = classifyUpload(bytes.subarray(0, HEAD_BYTES), claim.mime, {
    maxVideoBytes: MAX_DIRECT_VIDEO_BYTES,
    byteLength: bytes.length,
  });
  if ("error" in classified) return classified;
  if (classified.kind !== "video" || classified.mime !== claim.mime) return { error: "unsupported" };
  const wrote = await writeStoredFile(userId, claim.name, bytes, claim.mime);
  if (!wrote) return { error: "store" };
  return { ok: true };
}

export async function finishDirectVideo(
  userId: string,
  quoteId: string,
  input: { ticket: string; poster?: Uint8Array | null },
): Promise<{ item: QuoteMediaItem } | { error: MediaError }> {
  const claim = readDirectTicket(input.ticket);
  if (!claim || claim.userId !== userId || claim.quoteId !== quoteId) return { error: "unsupported" };
  const size = await storedObjectBytes(userId, claim.name);
  if (size == null || size !== claim.bytes) return { error: "upload" };
  return commitUploadedMedia(userId, quoteId, {
    id: claim.mediaId,
    mime: claim.mime,
    poster: input.poster,
  });
}
