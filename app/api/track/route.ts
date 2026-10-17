import { cookies } from "next/headers";

import {
  ANON_COOKIE,
  ANON_MAX_AGE,
  isClientEvent,
  isOpaqueId,
  isPlatform,
  PLATFORM_COOKIE,
  SESSION_COOKIE_NAME,
  SESSION_IDLE_SECONDS,
} from "@/lib/analytics/events";
import { track } from "@/lib/analytics/track";

export const dynamic = "force-dynamic";

const CLIENT_PROP_KEYS = ["action", "where"] as const;

function newId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as { name?: unknown; platform?: unknown; props?: Record<string, unknown> } | null;
  if (!payload || !isClientEvent(payload.name)) return Response.json({ ok: false }, { status: 400 });

  const store = await cookies();
  const options = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
  const knownAnon = store.get(ANON_COOKIE)?.value;
  const knownSession = store.get(SESSION_COOKIE_NAME)?.value;
  const anonId = isOpaqueId(knownAnon) ? knownAnon : newId();
  const sessionId = isOpaqueId(knownSession) ? knownSession : newId();
  const platform = isPlatform(payload.platform) ? payload.platform : "web";
  store.set(ANON_COOKIE, anonId, { ...options, maxAge: ANON_MAX_AGE });
  store.set(SESSION_COOKIE_NAME, sessionId, { ...options, maxAge: SESSION_IDLE_SECONDS });
  store.set(PLATFORM_COOKIE, platform, { ...options, maxAge: ANON_MAX_AGE });

  const context = { anonId, sessionId, platform };
  if (payload.name === "session_started") {
    if (sessionId === knownSession) return Response.json({ ok: true, stored: false });
    await track("session_started", { returning: anonId === knownAnon }, context);
    return Response.json({ ok: true, stored: true });
  }
  if (sessionId !== knownSession) await track("session_started", { returning: anonId === knownAnon }, context);

  const props: Record<string, string> = {};
  for (const key of CLIENT_PROP_KEYS) {
    const value = payload.props?.[key];
    if (typeof value === "string" && /^[a-z_]{1,24}$/.test(value)) props[key] = value;
  }
  await track(payload.name, props, context);
  return Response.json({ ok: true, stored: true });
}
