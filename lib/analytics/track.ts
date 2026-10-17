import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { cookies } from "next/headers";
import { after } from "next/server";

import { getSessionUser } from "../auth";
import { dataBackend } from "../env";
import { createClient } from "../supabase/server";
import type { SessionUser } from "../types";
import {
  ANON_COOKIE,
  ANON_EVENTS,
  cleanProps,
  isInternalEmail,
  isOpaqueId,
  isPlatform,
  PLATFORM_COOKIE,
  SESSION_COOKIE_NAME,
  type PmfEventName,
  type PmfProps,
} from "./events";

export interface PmfRow {
  id: string;
  userId: string | null;
  anonId: string | null;
  sessionId: string | null;
  platform: string | null;
  name: PmfEventName;
  props: Record<string, string>;
  createdAt: string;
}

export interface TrackContext {
  user?: SessionUser | null;
  anonId?: string | null;
  sessionId?: string | null;
  platform?: string | null;
}

const filePath = path.join(process.cwd(), "data", "pmf-events.json");
const LOCAL_CAP = 20_000;
const QUIET_MS = 5 * 60_000;

let chain: Promise<unknown> = Promise.resolve();
let quietUntil = 0;

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function readLocalPmf(): Promise<PmfRow[]> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as PmfRow[];
  } catch {
    return [];
  }
}

async function appendLocal(row: PmfRow): Promise<void> {
  await withLock(async () => {
    const rows = await readLocalPmf();
    rows.push(row);
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.tmp`;
    await writeFile(temporary, JSON.stringify(rows.slice(-LOCAL_CAP)));
    await rename(temporary, filePath);
  });
}

async function cookieContext(): Promise<{ anonId: string | null; sessionId: string | null; platform: string | null }> {
  try {
    const store = await cookies();
    const anonId = store.get(ANON_COOKIE)?.value;
    const sessionId = store.get(SESSION_COOKIE_NAME)?.value;
    const platform = store.get(PLATFORM_COOKIE)?.value;
    return {
      anonId: isOpaqueId(anonId) ? anonId : null,
      sessionId: isOpaqueId(sessionId) ? sessionId : null,
      platform: isPlatform(platform) ? platform : null,
    };
  } catch {
    return { anonId: null, sessionId: null, platform: null };
  }
}

function deferred(work: () => Promise<void>): Promise<void> {
  try {
    after(work);
    return Promise.resolve();
  } catch {
    return work();
  }
}

function logOnce(message: string) {
  if (Date.now() < quietUntil) return;
  quietUntil = Date.now() + QUIET_MS;
  console.error(`PMF event was not stored: ${message}`);
}

/**
 * Records one product event. Never throws and never blocks the caller's flow.
 * Props must not carry personal data; keys like email or name are dropped.
 */
export async function track(name: PmfEventName, props?: PmfProps, context: TrackContext = {}): Promise<void> {
  try {
    const user = context.user === undefined ? await getSessionUser().catch(() => null) : context.user;
    const fromCookies = await cookieContext();
    const row: PmfRow = {
      id: crypto.randomUUID(),
      userId: user?.id ?? null,
      anonId: context.anonId ?? fromCookies.anonId,
      sessionId: context.sessionId ?? fromCookies.sessionId,
      platform: context.platform ?? fromCookies.platform,
      name,
      props: cleanProps({
        ...props,
        plan: user?.plan,
        trade: user?.industry ?? undefined,
        guest: user ? user.guest : undefined,
        internal: user && isInternalEmail(user.email) ? true : undefined,
      }),
      createdAt: new Date().toISOString(),
    };
    if (!row.userId && !ANON_EVENTS.includes(name)) return;

    const backend = dataBackend();
    if (backend === "local") {
      await appendLocal(row);
      return;
    }
    if (backend !== "supabase") return;
    const supabase = await createClient();
    await deferred(async () => {
      const { error } = await supabase.from("funnel_events").insert({
        id: row.id,
        user_id: row.userId,
        anon_id: row.anonId,
        session_id: row.sessionId,
        platform: row.platform,
        name: row.name,
        props: row.props,
        created_at: row.createdAt,
      });
      if (error) logOnce(error.message);
    });
  } catch (error) {
    logOnce(error instanceof Error ? error.message : "unknown error");
  }
}
