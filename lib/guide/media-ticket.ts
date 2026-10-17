import { createHmac, timingSafeEqual } from "node:crypto";

import { sessionSecret } from "../session";
import { MAX_DIRECT_VIDEO_BYTES } from "./media-copy";

const TTL_SECONDS = 10 * 60;

export interface DirectTicket {
  userId: string;
  quoteId: string;
  mediaId: string;
  name: string;
  mime: string;
  bytes: number;
  exp: number;
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

/** Short-lived capability for one object. The secret stays on the server. */
export function issueDirectTicket(input: Omit<DirectTicket, "exp">, now = Date.now()): string {
  const body: DirectTicket = { ...input, exp: Math.floor(now / 1000) + TTL_SECONDS };
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readDirectTicket(token: string, now = Date.now()): DirectTicket | null {
  const split = token.split(".");
  if (split.length !== 2) return null;
  const [payload, sig] = split;
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as DirectTicket;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.exp !== "number" || parsed.exp * 1000 < now) return null;
    if (typeof parsed.userId !== "string" || typeof parsed.quoteId !== "string") return null;
    if (typeof parsed.mediaId !== "string" || typeof parsed.name !== "string") return null;
    if (!/^video\/(mp4|webm|quicktime)$/.test(parsed.mime)) return null;
    if (!Number.isInteger(parsed.bytes) || parsed.bytes < 32 || parsed.bytes > MAX_DIRECT_VIDEO_BYTES) return null;
    if (!parsed.name.startsWith("album-") || parsed.name.includes("/") || parsed.name.includes("..")) return null;
    return parsed;
  } catch {
    return null;
  }
}
