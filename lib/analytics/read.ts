import { dataBackend } from "../env";
import { listFunnelEvents } from "../guide/store";
import { createClient } from "../supabase/server";
import type { MetricEvent } from "./metrics";
import { readLocalPmf } from "./track";

const PAGE = 1000;
const MAX_ROWS = 20_000;

export interface PmfData {
  events: MetricEvent[];
  excluded: Set<string>;
  scope: "all" | "own";
  truncated: boolean;
}

function mapRow(row: Record<string, unknown>): MetricEvent {
  const props = row.props && typeof row.props === "object" ? (row.props as Record<string, string>) : {};
  return {
    userId: row.user_id ? String(row.user_id) : null,
    anonId: row.anon_id ? String(row.anon_id) : null,
    sessionId: row.session_id ? String(row.session_id) : null,
    name: String(row.name ?? ""),
    props,
    createdAt: String(row.created_at ?? ""),
  };
}

/** Server only. Uses the service role when it is set so the owner sees every account. */
export async function readPmfData(sinceDays = 120): Promise<PmfData> {
  if (dataBackend() !== "supabase") {
    const guide = await listFunnelEvents();
    const pmf = await readLocalPmf();
    const events: MetricEvent[] = [
      ...guide.map((event) => ({ userId: event.userId, anonId: null, sessionId: null, name: event.name, props: event.props, createdAt: event.createdAt })),
      ...pmf.map((event) => ({ userId: event.userId, anonId: event.anonId, sessionId: event.sessionId, name: event.name, props: event.props, createdAt: event.createdAt })),
    ];
    return { events, excluded: new Set(), scope: "all", truncated: false };
  }

  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const client =
    serviceKey && url
      ? (await import("@supabase/supabase-js")).createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
      : await createClient();

  const events: MetricEvent[] = [];
  let truncated = false;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from("funnel_events")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data as Record<string, unknown>[]) ?? [];
    events.push(...rows.map(mapRow));
    if (rows.length < PAGE) break;
    if (events.length >= MAX_ROWS) {
      truncated = true;
      break;
    }
  }

  const excluded = new Set<string>();
  const exclusions = await client.from("pmf_excluded_users").select("user_id");
  if (!exclusions.error) for (const row of (exclusions.data as { user_id: string }[]) ?? []) excluded.add(row.user_id);

  const users = new Set(events.map((event) => event.userId).filter(Boolean));
  return { events, excluded, scope: serviceKey && url ? "all" : users.size > 1 ? "all" : "own", truncated };
}
