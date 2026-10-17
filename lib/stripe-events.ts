import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { dataBackend } from "./env";

export interface StripeEventClaim {
  id: string;
  type?: string;
  livemode?: boolean;
}

interface StoredEvent {
  id: string;
  type: string;
  livemode: boolean;
  receivedAt: string;
}

/**
 * Local fallback used when Supabase is not configured. Tests can point this at a temp file.
 * Production idempotency uses the stripe_webhook_events table.
 */
function eventsPath(): string {
  return process.env.STRIPE_EVENT_STORE_PATH?.trim() || path.join(process.cwd(), "data", "stripe-webhook-events.json");
}

let chain: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readLocal(): Promise<StoredEvent[]> {
  try {
    const parsed = JSON.parse(await readFile(eventsPath(), "utf8")) as StoredEvent[];
    return Array.isArray(parsed) ? parsed.filter((row) => row && typeof row.id === "string") : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeLocal(rows: StoredEvent[]): Promise<void> {
  const file = eventsPath();
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(rows));
  await rename(temporary, file);
}

function storedFrom(event: StripeEventClaim): StoredEvent {
  return {
    id: event.id,
    type: event.type || "",
    livemode: event.livemode === true,
    receivedAt: new Date().toISOString(),
  };
}

async function claimLocal(event: StripeEventClaim): Promise<"claimed" | "duplicate"> {
  return withLock(async () => {
    const rows = await readLocal();
    if (rows.some((row) => row.id === event.id)) return "duplicate";
    rows.push(storedFrom(event));
    await writeLocal(rows.slice(-2000));
    return "claimed";
  });
}

async function releaseLocal(eventId: string): Promise<void> {
  return withLock(async () => {
    const rows = await readLocal();
    const next = rows.filter((row) => row.id !== eventId);
    if (next.length === rows.length) return;
    await writeLocal(next);
  });
}

async function supabaseAdmin() {
  if (dataBackend() !== "supabase") return null;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) {
    throw new Error("Stripe webhook idempotency needs SUPABASE_SERVICE_ROLE_KEY.");
  }
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function missingTable(message: string): boolean {
  return /stripe_webhook_events|schema cache|does not exist|could not find the table/i.test(message);
}

/**
 * Records a Stripe event id before it is applied. A second delivery of the same id
 * returns "duplicate" so the handler can acknowledge it without changing the plan again.
 */
export async function claimStripeEvent(event: StripeEventClaim): Promise<"claimed" | "duplicate"> {
  const eventId = event.id?.trim() || "";
  if (!eventId.startsWith("evt_")) throw new Error("Stripe event id is missing.");
  const client = await supabaseAdmin();
  if (!client) return claimLocal({ ...event, id: eventId });
  const { error } = await client.from("stripe_webhook_events").insert({
    id: eventId,
    event_type: event.type || "",
    livemode: event.livemode === true,
  });
  if (!error) return "claimed";
  if (error.code === "23505") return "duplicate";
  if (missingTable(error.message)) {
    throw new Error("Stripe webhook events table is missing. Apply supabase/migrations/20261017000000_stripe_webhook_events.sql.");
  }
  throw new Error(error.message || "Stripe webhook claim failed.");
}

/** Drops a claim after a failed apply so Stripe can retry the event. */
export async function releaseStripeEvent(eventId: string): Promise<void> {
  const id = eventId.trim();
  if (!id) return;
  const client = await supabaseAdmin();
  if (!client) {
    await releaseLocal(id);
    return;
  }
  const { error } = await client.from("stripe_webhook_events").delete().eq("id", id);
  if (error && !missingTable(error.message)) {
    throw new Error(error.message || "Stripe webhook release failed.");
  }
}
