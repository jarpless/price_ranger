import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { dataBackend } from "../env";
import { createClient } from "../supabase/server";
import {
  isFunnelEvent,
  isGuidePath,
  isGuideStep,
  isVariant,
  recordOnce,
  variantForUser,
  type FunnelEventName,
  type GuidePath,
  type GuideStep,
  type Variant,
} from "./flow";

export interface GuideUser {
  userId: string;
  variant: Variant;
  introCompletedAt: string | null;
  tosVersion: string | null;
  tosAcceptedAt: string | null;
  trialStartedAt: string | null;
  signedUpAt: string | null;
  ccpaDoNotSell: boolean;
  deletionRequestedAt: string | null;
}

export interface GuideQuote {
  quoteId: string;
  userId: string;
  path: GuidePath;
  step: GuideStep;
  description: string;
  priceCents: number | null;
  note: string;
  sources: string[];
  photoName: string | null;
  sharedAt: string | null;
  shareToken: string | null;
  outcome: "sold" | "not_yet" | null;
  sample: boolean;
  finishedAt: string | null;
  updatedAt: string;
}

export interface FunnelEvent {
  id: string;
  userId: string | null;
  name: FunnelEventName;
  props: Record<string, string>;
  createdAt: string;
}

interface GuideFile {
  users: GuideUser[];
  quotes: GuideQuote[];
  events: FunnelEvent[];
}

const filePath = path.join(process.cwd(), "data", "guide.json");

let chain: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function emptyFile(): GuideFile {
  return { users: [], quotes: [], events: [] };
}

async function readFileDb(): Promise<GuideFile> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as GuideFile;
    parsed.users ??= [];
    parsed.quotes ??= [];
    parsed.events ??= [];
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyFile();
    throw error;
  }
}

async function writeFileDb(file: GuideFile): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  await writeFile(temporary, JSON.stringify(file, null, 2));
  await rename(temporary, filePath);
}

function nowIso(): string {
  return new Date().toISOString();
}

function blankUser(userId: string): GuideUser {
  return {
    userId,
    variant: variantForUser(userId),
    introCompletedAt: null,
    tosVersion: null,
    tosAcceptedAt: null,
    trialStartedAt: null,
    signedUpAt: null,
    ccpaDoNotSell: false,
    deletionRequestedAt: null,
  };
}

function mapUser(row: Record<string, unknown>): GuideUser {
  const variant = String(row.variant ?? "");
  return {
    userId: String(row.user_id),
    variant: isVariant(variant) ? variant : variantForUser(String(row.user_id)),
    introCompletedAt: row.intro_completed_at ? String(row.intro_completed_at) : null,
    tosVersion: row.tos_version ? String(row.tos_version) : null,
    tosAcceptedAt: row.tos_accepted_at ? String(row.tos_accepted_at) : null,
    trialStartedAt: row.trial_started_at ? String(row.trial_started_at) : null,
    signedUpAt: row.signed_up_at ? String(row.signed_up_at) : null,
    ccpaDoNotSell: Boolean(row.ccpa_do_not_sell),
    deletionRequestedAt: row.deletion_requested_at ? String(row.deletion_requested_at) : null,
  };
}

function userToRow(user: GuideUser): Record<string, unknown> {
  return {
    user_id: user.userId,
    variant: user.variant,
    intro_completed_at: user.introCompletedAt,
    tos_version: user.tosVersion,
    tos_accepted_at: user.tosAcceptedAt,
    trial_started_at: user.trialStartedAt,
    signed_up_at: user.signedUpAt,
    ccpa_do_not_sell: user.ccpaDoNotSell,
    deletion_requested_at: user.deletionRequestedAt,
    updated_at: nowIso(),
  };
}

function mapQuote(row: Record<string, unknown>): GuideQuote | null {
  const pathName = String(row.path ?? "");
  const step = String(row.step ?? "");
  if (!isGuidePath(pathName) || !isGuideStep(step)) return null;
  const sources = Array.isArray(row.sources) ? row.sources.map((item) => String(item)) : [];
  const outcome = row.outcome === "sold" || row.outcome === "not_yet" ? row.outcome : null;
  return {
    quoteId: String(row.quote_id),
    userId: String(row.user_id),
    path: pathName,
    step,
    description: String(row.description ?? ""),
    priceCents: row.price_cents == null ? null : Number(row.price_cents),
    note: String(row.note ?? ""),
    sources,
    photoName: row.photo_name ? String(row.photo_name) : null,
    sharedAt: row.shared_at ? String(row.shared_at) : null,
    shareToken: row.share_token ? String(row.share_token) : null,
    outcome,
    sample: Boolean(row.sample),
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    updatedAt: String(row.updated_at ?? ""),
  };
}

function quoteToRow(quote: GuideQuote): Record<string, unknown> {
  return {
    quote_id: quote.quoteId,
    user_id: quote.userId,
    path: quote.path,
    step: quote.step,
    description: quote.description,
    price_cents: quote.priceCents,
    note: quote.note,
    sources: quote.sources,
    photo_name: quote.photoName,
    shared_at: quote.sharedAt,
    share_token: quote.shareToken,
    outcome: quote.outcome,
    sample: quote.sample,
    finished_at: quote.finishedAt,
    updated_at: quote.updatedAt,
  };
}

export async function ensureGuideUser(userId: string): Promise<GuideUser> {
  if (dataBackend() !== "supabase") {
    return withLock(async () => {
      const file = await readFileDb();
      let user = file.users.find((item) => item.userId === userId);
      if (!user) {
        user = { ...blankUser(userId), signedUpAt: nowIso() };
        file.users.push(user);
        await writeFileDb(file);
      }
      return user;
    });
  }
  const supabase = await createClient();
  const existing = await supabase.from("guide_users").select("*").eq("user_id", userId).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return mapUser(existing.data as Record<string, unknown>);
  const created = { ...blankUser(userId), signedUpAt: nowIso() };
  const inserted = await supabase.from("guide_users").insert(userToRow(created));
  if (inserted.error) throw new Error(inserted.error.message);
  return created;
}

export async function saveGuideUser(user: GuideUser): Promise<void> {
  if (dataBackend() !== "supabase") {
    await withLock(async () => {
      const file = await readFileDb();
      const index = file.users.findIndex((item) => item.userId === user.userId);
      if (index === -1) file.users.push(user);
      else file.users[index] = user;
      await writeFileDb(file);
    });
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("guide_users").upsert(userToRow(user));
  if (error) throw new Error(error.message);
}

export async function listGuideQuotes(userId: string): Promise<GuideQuote[]> {
  if (dataBackend() !== "supabase") {
    const file = await readFileDb();
    return file.quotes
      .filter((quote) => quote.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guide_quotes")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as Record<string, unknown>[]) ?? []).flatMap((row) => {
    const quote = mapQuote(row);
    return quote ? [quote] : [];
  });
}

export async function getGuideQuote(userId: string, quoteId: string): Promise<GuideQuote | null> {
  const quotes = await listGuideQuotes(userId);
  return quotes.find((quote) => quote.quoteId === quoteId) ?? null;
}

export async function saveGuideQuote(quote: GuideQuote): Promise<void> {
  const next = { ...quote, updatedAt: nowIso() };
  if (dataBackend() !== "supabase") {
    await withLock(async () => {
      const file = await readFileDb();
      const index = file.quotes.findIndex((item) => item.quoteId === next.quoteId);
      if (index === -1) file.quotes.push(next);
      else file.quotes[index] = next;
      await writeFileDb(file);
    });
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("guide_quotes").upsert(quoteToRow(next));
  if (error) throw new Error(error.message);
}

function alreadyRecorded(events: FunnelEvent[], userId: string | null, name: FunnelEventName, day: string): boolean {
  return events.some((event) => {
    if (event.name !== name) return false;
    if (recordOnce(name)) return event.userId === userId && userId != null;
    if (name === "upgrade_viewed") return event.userId === userId && event.createdAt.slice(0, 10) === day;
    return false;
  });
}

export async function recordFunnel(
  userId: string | null,
  name: FunnelEventName,
  props: Record<string, string> = {},
): Promise<void> {
  const createdAt = nowIso();
  if (dataBackend() !== "supabase") {
    await withLock(async () => {
      const file = await readFileDb();
      if (alreadyRecorded(file.events, userId, name, createdAt.slice(0, 10))) return;
      file.events.push({
        id: crypto.randomUUID(),
        userId,
        name,
        props,
        createdAt,
      });
      await writeFileDb(file);
    });
    return;
  }
  const supabase = await createClient();
  if (userId && (recordOnce(name) || name === "upgrade_viewed")) {
    const existing = await supabase
      .from("funnel_events")
      .select("id, created_at")
      .eq("user_id", userId)
      .eq("name", name);
    if (existing.error) throw new Error(existing.error.message);
    const rows = (existing.data as { created_at?: string }[]) ?? [];
    if (recordOnce(name) && rows.length > 0) return;
    if (name === "upgrade_viewed" && rows.some((row) => String(row.created_at ?? "").slice(0, 10) === createdAt.slice(0, 10))) {
      return;
    }
  }
  const { error } = await supabase.from("funnel_events").insert({
    id: crypto.randomUUID(),
    user_id: userId,
    name,
    props,
    created_at: createdAt,
  });
  if (error) throw new Error(error.message);
}

export async function listFunnelEvents(): Promise<FunnelEvent[]> {
  if (dataBackend() !== "supabase") {
    const file = await readFileDb();
    return [...file.events].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (serviceKey && url) {
    const { createClient: createService } = await import("@supabase/supabase-js");
    const service = createService(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await service
      .from("funnel_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return mapEvents(data as Record<string, unknown>[]);
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("funnel_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return mapEvents(data as Record<string, unknown>[]);
}

function mapEvents(rows: Record<string, unknown>[] | null): FunnelEvent[] {
  return (rows ?? []).flatMap((row) => {
    const name = String(row.name ?? "");
    if (!isFunnelEvent(name)) return [];
    const props = row.props && typeof row.props === "object" ? (row.props as Record<string, string>) : {};
    return [
      {
        id: String(row.id),
        userId: row.user_id ? String(row.user_id) : null,
        name,
        props,
        createdAt: String(row.created_at ?? ""),
      },
    ];
  });
}

export function funnelHasServiceRole(): boolean {
  return dataBackend() !== "supabase" || Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
