import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { dataBackend } from "../env";
import { isMissingSchema } from "../guide/schema";
import { createClient } from "../supabase/server";

import { replaceDuplicateLine, type ScoreLine, type ScoreResult, type Severity } from "./model";

export type TicketSource = "desktop" | "mobile" | "shake";

export interface TicketMeta {
  id: string;
  userId: string;
  email: string;
  summary: string;
  severity: Severity;
  duplicateOf: string | null;
  duplicateCount: number;
  score: number;
  lines: ScoreLine[];
  deviceId: string;
  source: TicketSource;
}

export interface TicketMessage {
  id: string;
  feedbackId: string;
  userId: string;
  author: "user" | "support";
  body: string;
  createdAt: string;
}

export interface TicketHistory {
  id: string;
  feedbackId: string;
  actorId: string;
  fromStatus: string | null;
  toStatus: string;
  note: string;
  createdAt: string;
}

export interface TicketImage {
  id: string;
  feedbackId: string;
  userId: string;
  storagePath: string;
  createdAt: string;
}

export interface AppEvent {
  id: string;
  userId: string;
  deviceId: string;
  name: string;
  route: string;
  createdAt: string;
}

export interface OpenBrief {
  id: string;
  userId: string;
  summary: string;
  body: string;
  kind: string;
  githubIssueUrl: string | null;
  duplicateCount: number;
  score: number;
  lines: ScoreLine[];
}

interface DeskFile {
  metas: TicketMeta[];
  messages: TicketMessage[];
  history: TicketHistory[];
  images: TicketImage[];
  events: AppEvent[];
}

const filePath = path.join(process.cwd(), "data", "feedback-desk.json");
const shotRoot = path.join(process.cwd(), "data", "feedback");
let chain: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function emptyFile(): DeskFile {
  return { metas: [], messages: [], history: [], images: [], events: [] };
}

async function readLocal(): Promise<DeskFile> {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as Partial<DeskFile>;
    return {
      metas: parsed.metas ?? [],
      messages: parsed.messages ?? [],
      history: parsed.history ?? [],
      images: parsed.images ?? [],
      events: parsed.events ?? [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyFile();
    throw error;
  }
}

async function writeLocal(file: DeskFile): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  await writeFile(temporary, JSON.stringify(file, null, 2));
  await rename(temporary, filePath);
}

function nowIso(): string {
  return new Date().toISOString();
}

interface LooseQuery extends PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }> {
  select: (columns?: string) => LooseQuery;
  insert: (values: unknown) => LooseQuery;
  update: (values: unknown) => LooseQuery;
  eq: (column: string, value: unknown) => LooseQuery;
  order: (column: string, options?: { ascending?: boolean }) => LooseQuery;
  limit: (count: number) => LooseQuery;
}

interface LooseSupabase {
  from: (table: string) => LooseQuery;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        body: Uint8Array,
        options: { contentType: string; upsert: boolean },
      ) => Promise<{ error: { message: string } | null }>;
      download: (path: string) => Promise<{ data: Blob | null; error: { message: string } | null }>;
    };
  };
}

async function supabase(): Promise<LooseSupabase> {
  return (await createClient()) as unknown as LooseSupabase;
}

function linesOf(value: unknown): ScoreLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const line = row as { factor?: unknown; points?: unknown; reason?: unknown };
    return [{ factor: String(line.factor ?? ""), points: Number(line.points ?? 0), reason: String(line.reason ?? "") }];
  });
}

function asMeta(row: Record<string, unknown>): TicketMeta {
  const severity = row.severity === "low" || row.severity === "high" ? row.severity : "medium";
  const source = row.source === "mobile" || row.source === "shake" ? row.source : "desktop";
  return {
    id: String(row.id),
    userId: String(row.user_id ?? row.userId ?? ""),
    email: String(row.email ?? ""),
    summary: String(row.summary ?? ""),
    severity,
    duplicateOf: (row.duplicate_of as string | null) ?? (row.duplicateOf as string | null) ?? null,
    duplicateCount: Number(row.duplicate_count ?? row.duplicateCount ?? 0),
    score: Number(row.score ?? 0),
    lines: linesOf(row.score_breakdown ?? row.lines),
    deviceId: String(row.device_id ?? row.deviceId ?? ""),
    source,
  };
}

export async function saveTicketMeta(meta: TicketMeta): Promise<void> {
  if (dataBackend() !== "supabase") {
    await withLock(async () => {
      const file = await readLocal();
      const index = file.metas.findIndex((row) => row.id === meta.id);
      if (index === -1) file.metas.unshift(meta);
      else file.metas[index] = meta;
      await writeLocal(file);
    });
    return;
  }
  const client = await supabase();
  const { error } = await client
    .from("feedback")
    .update({
      summary: meta.summary,
      severity: meta.severity,
      duplicate_of: meta.duplicateOf,
      duplicate_count: meta.duplicateCount,
      score: meta.score,
      score_breakdown: meta.lines,
      device_id: meta.deviceId,
      source: meta.source,
      updated_at: nowIso(),
    })
    .eq("id", meta.id);
  if (error && !isMissingSchema(error)) throw new Error(error.message);
  if (!error) return;
  await withLock(async () => {
    const file = await readLocal();
    file.metas.unshift(meta);
    await writeLocal(file);
  });
}

export async function listTicketMetas(): Promise<TicketMeta[]> {
  if (dataBackend() !== "supabase") {
    const file = await readLocal();
    return file.metas;
  }
  const client = await supabase();
  const { data, error } = await client.from("feedback").select("id, user_id, summary, severity, duplicate_of, duplicate_count, score, score_breakdown, device_id, source");
  if (error) {
    if (isMissingSchema(error)) return (await readLocal()).metas;
    throw new Error(error.message);
  }
  return ((data as Record<string, unknown>[]) ?? []).map(asMeta);
}

export async function listOpenBriefs(): Promise<OpenBrief[]> {
  if (dataBackend() !== "supabase") {
    const file = await readLocal();
    return file.metas
      .filter((meta) => !meta.duplicateOf)
      .map((meta) => ({
        id: meta.id,
        userId: meta.userId,
        summary: meta.summary,
        body: meta.summary,
        kind: "bug",
        githubIssueUrl: null,
        duplicateCount: meta.duplicateCount,
        score: meta.score,
        lines: meta.lines,
      }));
  }
  const client = await supabase();
  const { data, error } = await client.rpc("feedback_open_briefs");
  if (error) {
    if (isMissingSchema(error)) return [];
    const fallback = await client
      .from("feedback")
      .select("id, user_id, summary, body, kind, github_issue_url, duplicate_count, score, score_breakdown, duplicate_of, status")
      .limit(80);
    if (fallback.error) return [];
    return ((fallback.data as Record<string, unknown>[]) ?? [])
      .filter((row) => !row.duplicate_of && row.status !== "shipped")
      .map((row) => ({
        id: String(row.id),
        userId: String(row.user_id),
        summary: String(row.summary ?? ""),
        body: String(row.body ?? ""),
        kind: String(row.kind ?? "bug"),
        githubIssueUrl: (row.github_issue_url as string | null) ?? null,
        duplicateCount: Number(row.duplicate_count ?? 0),
        score: Number(row.score ?? 0),
        lines: linesOf(row.score_breakdown),
      }));
  }
  return ((data as Record<string, unknown>[]) ?? []).map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    summary: String(row.summary ?? ""),
    body: String(row.body ?? ""),
    kind: String(row.kind ?? "bug"),
    githubIssueUrl: (row.github_issue_url as string | null) ?? null,
    duplicateCount: Number(row.duplicate_count ?? 0),
    score: Number(row.score ?? 0),
    lines: linesOf(row.score_breakdown),
  }));
}

export async function bumpDuplicate(canonicalId: string): Promise<void> {
  if (dataBackend() !== "supabase") {
    await withLock(async () => {
      const file = await readLocal();
      const meta = file.metas.find((row) => row.id === canonicalId);
      if (!meta) return;
      const next = replaceDuplicateLine({ score: meta.score, lines: meta.lines }, meta.duplicateCount + 1);
      meta.duplicateCount += 1;
      meta.score = next.score;
      meta.lines = next.lines;
      await writeLocal(file);
    });
    return;
  }
  const briefs = await listOpenBriefs();
  const current = briefs.find((row) => row.id === canonicalId);
  const nextCount = (current?.duplicateCount ?? 0) + 1;
  const rescored: ScoreResult = replaceDuplicateLine(
    { score: current?.score ?? 0, lines: current?.lines ?? [] },
    nextCount,
  );
  const client = await supabase();
  const { error } = await client.rpc("feedback_apply_duplicate", {
    canonical: canonicalId,
    next_score: rescored.score,
    breakdown: rescored.lines,
  });
  if (error && !isMissingSchema(error)) throw new Error(error.message);
}

export async function addHistory(entry: Omit<TicketHistory, "id" | "createdAt"> & { id?: string }): Promise<void> {
  const row: TicketHistory = {
    id: entry.id || crypto.randomUUID(),
    feedbackId: entry.feedbackId,
    actorId: entry.actorId,
    fromStatus: entry.fromStatus,
    toStatus: entry.toStatus,
    note: entry.note,
    createdAt: nowIso(),
  };
  if (dataBackend() !== "supabase") {
    await withLock(async () => {
      const file = await readLocal();
      file.history.unshift(row);
      await writeLocal(file);
    });
    return;
  }
  const client = await supabase();
  const { error } = await client.from("feedback_history").insert({
    id: row.id,
    feedback_id: row.feedbackId,
    actor_id: row.actorId,
    from_status: row.fromStatus,
    to_status: row.toStatus,
    note: row.note,
    created_at: row.createdAt,
  });
  if (error && !isMissingSchema(error)) throw new Error(error.message);
}

export async function listHistory(feedbackId: string): Promise<TicketHistory[]> {
  if (dataBackend() !== "supabase") {
    const file = await readLocal();
    return file.history.filter((row) => row.feedbackId === feedbackId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  const client = await supabase();
  const { data, error } = await client.from("feedback_history").select("*").eq("feedback_id", feedbackId).order("created_at", { ascending: true });
  if (error) {
    if (isMissingSchema(error)) return [];
    throw new Error(error.message);
  }
  return ((data as Record<string, unknown>[]) ?? []).map((row) => ({
    id: String(row.id),
    feedbackId: String(row.feedback_id),
    actorId: String(row.actor_id ?? ""),
    fromStatus: (row.from_status as string | null) ?? null,
    toStatus: String(row.to_status ?? ""),
    note: String(row.note ?? ""),
    createdAt: String(row.created_at ?? ""),
  }));
}

export async function addMessage(entry: Omit<TicketMessage, "id" | "createdAt">): Promise<TicketMessage> {
  const row: TicketMessage = { ...entry, id: crypto.randomUUID(), createdAt: nowIso() };
  if (dataBackend() !== "supabase") {
    await withLock(async () => {
      const file = await readLocal();
      file.messages.push(row);
      await writeLocal(file);
    });
    return row;
  }
  const client = await supabase();
  const { error } = await client.from("feedback_messages").insert({
    id: row.id,
    feedback_id: row.feedbackId,
    user_id: row.userId,
    author: row.author,
    body: row.body,
    created_at: row.createdAt,
  });
  if (error) {
    if (isMissingSchema(error)) return row;
    throw new Error(error.message);
  }
  return row;
}

export async function listMessages(feedbackId: string): Promise<TicketMessage[]> {
  if (dataBackend() !== "supabase") {
    const file = await readLocal();
    return file.messages.filter((row) => row.feedbackId === feedbackId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  const client = await supabase();
  const { data, error } = await client.from("feedback_messages").select("*").eq("feedback_id", feedbackId).order("created_at", { ascending: true });
  if (error) {
    if (isMissingSchema(error)) return [];
    throw new Error(error.message);
  }
  return ((data as Record<string, unknown>[]) ?? []).map((row) => ({
    id: String(row.id),
    feedbackId: String(row.feedback_id),
    userId: String(row.user_id),
    author: row.author === "support" ? "support" : "user",
    body: String(row.body ?? ""),
    createdAt: String(row.created_at ?? ""),
  }));
}

export async function saveExtraImage(input: { feedbackId: string; userId: string; png: Uint8Array }): Promise<TicketImage | null> {
  if (input.png.byteLength === 0) return null;
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  if (dataBackend() === "supabase") {
    const storagePath = `${input.userId}/${input.feedbackId}/${id}.png`;
    const client = await supabase();
    const uploaded = await client.storage.from("feedback").upload(storagePath, input.png, { contentType: "image/png", upsert: true });
    if (uploaded.error) throw new Error(uploaded.error.message);
    const row: TicketImage = { id, feedbackId: input.feedbackId, userId: input.userId, storagePath, createdAt };
    const { error } = await client.from("feedback_images").insert({
      id,
      feedback_id: input.feedbackId,
      user_id: input.userId,
      storage_path: storagePath,
      created_at: createdAt,
    });
    if (error && !isMissingSchema(error)) throw new Error(error.message);
    return row;
  }
  const storagePath = `${id}.png`;
  const directory = path.join(shotRoot, input.userId, input.feedbackId);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, storagePath), input.png);
  const row: TicketImage = { id, feedbackId: input.feedbackId, userId: input.userId, storagePath, createdAt };
  await withLock(async () => {
    const file = await readLocal();
    file.images.push(row);
    await writeLocal(file);
  });
  return row;
}

export async function listImages(feedbackId: string): Promise<TicketImage[]> {
  if (dataBackend() !== "supabase") {
    const file = await readLocal();
    return file.images.filter((row) => row.feedbackId === feedbackId);
  }
  const client = await supabase();
  const { data, error } = await client.from("feedback_images").select("*").eq("feedback_id", feedbackId);
  if (error) {
    if (isMissingSchema(error)) return [];
    throw new Error(error.message);
  }
  return ((data as Record<string, unknown>[]) ?? []).map((row) => ({
    id: String(row.id),
    feedbackId: String(row.feedback_id),
    userId: String(row.user_id),
    storagePath: String(row.storage_path ?? ""),
    createdAt: String(row.created_at ?? ""),
  }));
}

export async function readExtraImage(feedbackId: string, imageId: string): Promise<Uint8Array | null> {
  const images = await listImages(feedbackId);
  const image = images.find((row) => row.id === imageId);
  if (!image) return null;
  if (dataBackend() === "supabase") {
    const client = await supabase();
    const downloaded = await client.storage.from("feedback").download(image.storagePath);
    if (downloaded.error || !downloaded.data) return null;
    return new Uint8Array(await downloaded.data.arrayBuffer());
  }
  try {
    const bytes = await readFile(path.join(shotRoot, image.userId, feedbackId, image.storagePath));
    return new Uint8Array(bytes);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function addAppEvent(event: Omit<AppEvent, "id" | "createdAt">): Promise<void> {
  const row: AppEvent = { ...event, id: crypto.randomUUID(), createdAt: nowIso() };
  if (dataBackend() !== "supabase") {
    await withLock(async () => {
      const file = await readLocal();
      file.events.unshift(row);
      file.events = file.events.slice(0, 2000);
      await writeLocal(file);
    });
    return;
  }
  const client = await supabase();
  const { error } = await client.from("app_events").insert({
    id: row.id,
    user_id: row.userId,
    device_id: row.deviceId,
    name: row.name,
    route: row.route,
    created_at: row.createdAt,
  });
  if (error && !isMissingSchema(error)) throw new Error(error.message);
}

export async function listAppEvents(userId: string): Promise<AppEvent[]> {
  if (dataBackend() !== "supabase") {
    const file = await readLocal();
    return file.events.filter((row) => row.userId === userId);
  }
  const client = await supabase();
  const { data, error } = await client.from("app_events").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200);
  if (error) {
    if (isMissingSchema(error)) return [];
    throw new Error(error.message);
  }
  return ((data as Record<string, unknown>[]) ?? []).map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    deviceId: String(row.device_id ?? ""),
    name: String(row.name ?? ""),
    route: String(row.route ?? ""),
    createdAt: String(row.created_at ?? ""),
  }));
}

export async function ensureSupportOwner(email: string): Promise<void> {
  const cleaned = email.trim().toLowerCase();
  if (!cleaned || dataBackend() !== "supabase") return;
  const client = await supabase();
  const { error } = await client.from("support_owners").insert({ email: cleaned });
  if (error && !isMissingSchema(error) && !/duplicate|unique/i.test(error.message)) {
    return;
  }
}

export async function metaFor(id: string): Promise<TicketMeta | null> {
  const metas = await listTicketMetas();
  return metas.find((row) => row.id === id) ?? null;
}
