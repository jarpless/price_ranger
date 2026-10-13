import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { dataBackend } from "../env";
import { isMissingSchema } from "../guide/schema";
import { createClient } from "../supabase/server";

export type FeedbackKind = "bug" | "feature";
export type FeedbackStatus = "new" | "planned" | "in_progress" | "shipped";

export interface FeedbackReport {
  id: string;
  userId: string;
  kind: FeedbackKind;
  body: string;
  route: string;
  versionLabel: string;
  gitSha: string;
  env: string;
  viewport: string;
  userAgent: string;
  consoleErrors: string[];
  screenshotPath: string | null;
  status: FeedbackStatus;
  shippedIn: string | null;
  githubIssueUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TourStep {
  caption: string;
  href: string;
  spotlight: string;
}

export interface GuidedTour {
  id: string;
  userId: string;
  title: string;
  prompt: string;
  steps: TourStep[];
  createdAt: string;
}

export interface UsageEvent {
  id: string;
  userId: string;
  mode: "ask" | "agent";
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  createdAt: string;
}

interface LocalFile {
  preferences: { userId: string; feedbackEnabled: boolean }[];
  feedback: FeedbackReport[];
  tours: GuidedTour[];
  usage: UsageEvent[];
}

const filePath = path.join(process.cwd(), "data", "basecamp.json");
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

function emptyFile(): LocalFile {
  return { preferences: [], feedback: [], tours: [], usage: [] };
}

async function readLocal(): Promise<LocalFile> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<LocalFile>;
    return {
      preferences: parsed.preferences ?? [],
      feedback: parsed.feedback ?? [],
      tours: parsed.tours ?? [],
      usage: parsed.usage ?? [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyFile();
    throw error;
  }
}

async function writeLocal(file: LocalFile): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  await writeFile(temporary, JSON.stringify(file, null, 2));
  await rename(temporary, filePath);
}

function nowIso(): string {
  return new Date().toISOString();
}

interface LooseQuery extends PromiseLike<{ data: unknown; error: { message: string } | null }> {
  select: (columns?: string) => LooseQuery;
  insert: (values: unknown) => LooseQuery;
  update: (values: unknown) => LooseQuery;
  upsert: (values: unknown, options?: { onConflict?: string }) => LooseQuery;
  eq: (column: string, value: unknown) => LooseQuery;
  order: (column: string, options?: { ascending?: boolean }) => LooseQuery;
  maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
  single: () => Promise<{ data: unknown; error: { message: string } | null }>;
}

interface LooseSupabase {
  from: (table: string) => LooseQuery;
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        body: Uint8Array,
        options: { contentType: string; upsert: boolean },
      ) => Promise<{ error: { message: string } | null }>;
      download: (path: string) => Promise<{ data: Blob | null; error: { message: string } | null }>;
      createSignedUrl: (
        path: string,
        expires: number,
      ) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
    };
  };
}

async function supabase(): Promise<LooseSupabase> {
  return (await createClient()) as unknown as LooseSupabase;
}

function asReport(row: Record<string, unknown>): FeedbackReport {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    kind: row.kind === "feature" ? "feature" : "bug",
    body: String(row.body ?? ""),
    route: String(row.route ?? ""),
    versionLabel: String(row.version_label ?? ""),
    gitSha: String(row.git_sha ?? ""),
    env: String(row.env ?? ""),
    viewport: String(row.viewport ?? ""),
    userAgent: String(row.user_agent ?? ""),
    consoleErrors: Array.isArray(row.console_errors) ? row.console_errors.map(String) : [],
    screenshotPath: (row.screenshot_path as string | null) ?? null,
    status: (row.status as FeedbackStatus) || "new",
    shippedIn: (row.shipped_in as string | null) ?? null,
    githubIssueUrl: (row.github_issue_url as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function getPreferences(userId: string): Promise<{ feedbackEnabled: boolean }> {
  if (dataBackend() !== "supabase") {
    const file = await readLocal();
    const row = file.preferences.find((item) => item.userId === userId);
    return { feedbackEnabled: Boolean(row?.feedbackEnabled) };
  }
  const client = await supabase();
  const { data, error } = await client
    .from("profiles")
    .select("feedback_enabled")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    if (isMissingSchema(error)) return { feedbackEnabled: false };
    throw new Error(error.message);
  }
  const row = data as { feedback_enabled?: boolean } | null;
  return { feedbackEnabled: Boolean(row?.feedback_enabled) };
}

export async function setFeedbackEnabled(userId: string, enabled: boolean, email = ""): Promise<void> {
  if (dataBackend() !== "supabase") {
    await withLock(async () => {
      const file = await readLocal();
      const row = file.preferences.find((item) => item.userId === userId);
      if (row) row.feedbackEnabled = enabled;
      else file.preferences.push({ userId, feedbackEnabled: enabled });
      await writeLocal(file);
    });
    return;
  }
  const client = await supabase();
  const { error } = await client.from("profiles").upsert(
    { id: userId, email, feedback_enabled: enabled },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);
}

export async function createFeedback(input: {
  userId: string;
  kind: FeedbackKind;
  body: string;
  route: string;
  versionLabel: string;
  gitSha: string;
  env: string;
  viewport: string;
  userAgent: string;
  consoleErrors: string[];
  png: Uint8Array | null;
}): Promise<FeedbackReport> {
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  let screenshotPath: string | null = null;

  if (input.png && input.png.byteLength > 0) {
    if (dataBackend() === "supabase") {
      screenshotPath = `${input.userId}/${id}.png`;
      const client = await supabase();
      const uploaded = await client.storage.from("feedback").upload(screenshotPath, input.png, {
        contentType: "image/png",
        upsert: true,
      });
      if (uploaded.error) throw new Error(uploaded.error.message);
    } else {
      screenshotPath = `${id}.png`;
      const directory = path.join(shotRoot, input.userId);
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, `${id}.png`), input.png);
    }
  }

  const report: FeedbackReport = {
    id,
    userId: input.userId,
    kind: input.kind,
    body: input.body,
    route: input.route,
    versionLabel: input.versionLabel,
    gitSha: input.gitSha,
    env: input.env,
    viewport: input.viewport,
    userAgent: input.userAgent,
    consoleErrors: input.consoleErrors.slice(0, 20),
    screenshotPath,
    status: "new",
    shippedIn: null,
    githubIssueUrl: null,
    createdAt,
    updatedAt: createdAt,
  };

  if (dataBackend() !== "supabase") {
    await withLock(async () => {
      const file = await readLocal();
      file.feedback.unshift(report);
      await writeLocal(file);
    });
    return report;
  }

  const client = await supabase();
  const { error } = await client.from("feedback").insert({
    id,
    user_id: input.userId,
    kind: input.kind,
    body: input.body,
    route: input.route,
    version_label: input.versionLabel,
    git_sha: input.gitSha,
    env: input.env,
    viewport: input.viewport,
    user_agent: input.userAgent,
    console_errors: report.consoleErrors,
    screenshot_path: screenshotPath,
    status: "new",
    created_at: createdAt,
    updated_at: createdAt,
  });
  if (error) throw new Error(error.message);
  return report;
}

export async function attachGithubIssue(
  userId: string,
  feedbackId: string,
  url: string,
): Promise<void> {
  if (dataBackend() !== "supabase") {
    await withLock(async () => {
      const file = await readLocal();
      const report = file.feedback.find((item) => item.id === feedbackId && item.userId === userId);
      if (!report) return;
      report.githubIssueUrl = url;
      report.updatedAt = nowIso();
      await writeLocal(file);
    });
    return;
  }
  const client = await supabase();
  const { error } = await client
    .from("feedback")
    .update({ github_issue_url: url, updated_at: nowIso() })
    .eq("id", feedbackId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function listFeedback(userId: string): Promise<FeedbackReport[]> {
  if (dataBackend() !== "supabase") {
    const file = await readLocal();
    return file.feedback
      .filter((item) => item.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const client = await supabase();
  const { data, error } = await client
    .from("feedback")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as Record<string, unknown>[]) ?? []).map(asReport);
}

export async function getFeedback(userId: string, id: string): Promise<FeedbackReport | null> {
  const rows = await listFeedback(userId);
  return rows.find((item) => item.id === id) ?? null;
}

export async function updateFeedback(
  userId: string,
  id: string,
  input: { status: FeedbackStatus; shippedIn: string | null },
): Promise<boolean> {
  if (dataBackend() !== "supabase") {
    return withLock(async () => {
      const file = await readLocal();
      const report = file.feedback.find((item) => item.id === id && item.userId === userId);
      if (!report) return false;
      report.status = input.status;
      report.shippedIn = input.status === "shipped" ? input.shippedIn : null;
      report.updatedAt = nowIso();
      await writeLocal(file);
      return true;
    });
  }
  const client = await supabase();
  const { data, error } = await client
    .from("feedback")
    .update({
      status: input.status,
      shipped_in: input.status === "shipped" ? input.shippedIn : null,
      updated_at: nowIso(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");
  if (error) throw new Error(error.message);
  return ((data as unknown[]) ?? []).length > 0;
}

export async function readFeedbackPng(userId: string, id: string): Promise<Uint8Array | null> {
  const report = await getFeedback(userId, id);
  if (!report?.screenshotPath) return null;
  if (dataBackend() === "supabase") {
    const client = await supabase();
    const downloaded = await client.storage.from("feedback").download(report.screenshotPath);
    if (downloaded.error || !downloaded.data) return null;
    return new Uint8Array(await downloaded.data.arrayBuffer());
  }
  try {
    const bytes = await readFile(path.join(shotRoot, userId, report.screenshotPath));
    return new Uint8Array(bytes);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function feedbackScreenshotUrl(userId: string, id: string): Promise<string | null> {
  const report = await getFeedback(userId, id);
  if (!report?.screenshotPath || dataBackend() !== "supabase") return null;
  const client = await supabase();
  const signed = await client.storage.from("feedback").createSignedUrl(report.screenshotPath, 60 * 60 * 24 * 7);
  if (signed.error || !signed.data?.signedUrl) return null;
  return signed.data.signedUrl;
}

export async function saveTour(input: {
  userId: string;
  title: string;
  prompt: string;
  steps: TourStep[];
}): Promise<string> {
  const tour: GuidedTour = {
    id: crypto.randomUUID(),
    userId: input.userId,
    title: input.title.slice(0, 120),
    prompt: input.prompt.slice(0, 500),
    steps: input.steps.slice(0, 12),
    createdAt: nowIso(),
  };
  if (dataBackend() !== "supabase") {
    await withLock(async () => {
      const file = await readLocal();
      file.tours.unshift(tour);
      await writeLocal(file);
    });
    return tour.id;
  }
  const client = await supabase();
  const { error } = await client.from("guided_tours").insert({
    id: tour.id,
    user_id: input.userId,
    title: tour.title,
    prompt: tour.prompt,
    steps: tour.steps,
    created_at: tour.createdAt,
  });
  if (error) throw new Error(error.message);
  return tour.id;
}

export async function reassignBasecamp(fromUserId: string, toUserId: string): Promise<void> {
  if (!fromUserId || fromUserId === toUserId || dataBackend() === "supabase") return;
  await withLock(async () => {
    const file = await readLocal();
    for (const row of file.preferences) if (row.userId === fromUserId) row.userId = toUserId;
    for (const row of file.feedback) if (row.userId === fromUserId) row.userId = toUserId;
    for (const row of file.tours) if (row.userId === fromUserId) row.userId = toUserId;
    for (const row of file.usage) if (row.userId === fromUserId) row.userId = toUserId;
    await writeLocal(file);
  });
}

export async function recordUsage(event: UsageEvent): Promise<void> {
  if (dataBackend() !== "supabase") {
    await withLock(async () => {
      const file = await readLocal();
      file.usage.unshift(event);
      await writeLocal(file);
    });
    return;
  }
  const client = await supabase();
  const { error } = await client.from("assistant_usage").insert({
    id: event.id,
    user_id: event.userId,
    mode: event.mode,
    provider: event.provider,
    model: event.model,
    input_tokens: event.inputTokens,
    output_tokens: event.outputTokens,
    cost_usd: event.costUsd,
    created_at: event.createdAt,
  });
  if (error) {
    if (isMissingSchema(error)) return;
    throw new Error(error.message);
  }
}

export async function listUsage(userId: string, allAccounts: boolean): Promise<UsageEvent[]> {
  if (dataBackend() !== "supabase") {
    const file = await readLocal();
    const rows = allAccounts ? file.usage : file.usage.filter((item) => item.userId === userId);
    return rows.slice(0, 100);
  }
  const client = await supabase();
  const { data, error } = await client
    .from("assistant_usage")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingSchema(error)) return [];
    throw new Error(error.message);
  }
  return ((data as Record<string, unknown>[]) ?? []).slice(0, 100).map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    mode: row.mode === "agent" ? "agent" : "ask",
    provider: String(row.provider ?? ""),
    model: String(row.model ?? ""),
    inputTokens: Number(row.input_tokens ?? 0),
    outputTokens: Number(row.output_tokens ?? 0),
    costUsd: Number(row.cost_usd ?? 0),
    createdAt: String(row.created_at ?? ""),
  }));
}

export async function getTour(userId: string, id: string): Promise<GuidedTour | null> {
  if (dataBackend() !== "supabase") {
    const file = await readLocal();
    return file.tours.find((tour) => tour.id === id && tour.userId === userId) ?? null;
  }
  const client = await supabase();
  const { data, error } = await client
    .from("guided_tours")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title ?? ""),
    prompt: String(row.prompt ?? ""),
    steps: Array.isArray(row.steps) ? (row.steps as TourStep[]) : [],
    createdAt: String(row.created_at ?? ""),
  };
}
