/** Pure metric math for /admin/pmf. Mirrors the pmf_ SQL views in 20261017200000_pmf_events.sql. */

export interface MetricEvent {
  userId: string | null;
  anonId: string | null;
  sessionId: string | null;
  name: string;
  props: Record<string, string>;
  createdAt: string;
}

export interface ActivationFunnel {
  signups: number;
  priced: number;
  activated24h: number;
  shared: number;
  sold: number;
  secondPrice7d: number;
  paid30d: number;
}

export interface CohortRow {
  week: string;
  signups: number;
  activated: number;
  returnedD1: number;
  returnedD7: number;
  repeatD1: number;
  repeatD7: number;
  repeatD30: number;
}

export interface ShareLoop {
  views: number;
  viewers: number;
  headerClickers: number;
  signupClickers: number;
  signupsFromShare: number;
}

export interface PaidFunnel {
  planViewers: number;
  checkoutStarters: number;
  purchasers: number;
}

export interface PmfSummary {
  funnel: ActivationFunnel;
  cohorts: CohortRow[];
  share: ShareLoop;
  paid: PaidFunnel;
  events: number;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const PRICE_EVENTS = new Set(["price_result_shown", "first_price_generated"]);
const SHARE_EVENTS = new Set(["quote_shared", "first_share"]);
const SOLD_EVENTS = new Set(["item_marked_sold", "first_mark_sold"]);

export function isCounted(event: MetricEvent, excluded: ReadonlySet<string> = new Set()): boolean {
  if (event.props?.internal === "true") return false;
  if (event.userId && excluded.has(event.userId)) return false;
  return true;
}

/** Monday of the UTC week, as YYYY-MM-DD. Matches Postgres date_trunc('week'). */
export function weekOf(iso: string): string {
  const date = new Date(iso);
  const day = (date.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
}

function within(times: number[], from: number, to: number): boolean {
  return times.some((time) => time >= from && time < to);
}

interface UserFacts {
  signedUpAt: number;
  prices: number[];
  sessions: number[];
  firstShare: number | null;
  firstSold: number | null;
  purchases: number[];
  anonIds: Set<string>;
}

function distinct<T>(values: (T | null | undefined)[]): number {
  return new Set(values.filter((value) => value != null)).size;
}

export function summarize(input: MetricEvent[], excluded: ReadonlySet<string> = new Set()): PmfSummary {
  const events = input.filter((event) => isCounted(event, excluded));
  const byUser = new Map<string, MetricEvent[]>();
  for (const event of events) {
    if (!event.userId) continue;
    const list = byUser.get(event.userId) ?? [];
    list.push(event);
    byUser.set(event.userId, list);
  }

  const users: UserFacts[] = [];
  for (const list of byUser.values()) {
    const signups = list.filter((event) => event.name === "signup").map((event) => Date.parse(event.createdAt));
    if (signups.length === 0) continue;
    const times = (names: Set<string>) =>
      list.filter((event) => names.has(event.name)).map((event) => Date.parse(event.createdAt)).sort((a, b) => a - b);
    const shares = times(SHARE_EVENTS);
    const sold = times(SOLD_EVENTS);
    users.push({
      signedUpAt: Math.min(...signups),
      prices: times(PRICE_EVENTS),
      sessions: times(new Set(["session_started"])),
      firstShare: shares[0] ?? null,
      firstSold: sold[0] ?? null,
      purchases: times(new Set(["checkout_completed"])),
      anonIds: new Set(list.map((event) => event.anonId).filter((id): id is string => Boolean(id))),
    });
  }

  const funnel: ActivationFunnel = { signups: 0, priced: 0, activated24h: 0, shared: 0, sold: 0, secondPrice7d: 0, paid30d: 0 };
  const cohorts = new Map<string, CohortRow>();
  for (const user of users) {
    const first = user.prices[0] ?? null;
    const week = weekOf(new Date(user.signedUpAt).toISOString());
    const row = cohorts.get(week) ?? { week, signups: 0, activated: 0, returnedD1: 0, returnedD7: 0, repeatD1: 0, repeatD7: 0, repeatD30: 0 };
    funnel.signups += 1;
    row.signups += 1;
    if (user.firstShare != null) funnel.shared += 1;
    if (user.firstSold != null) funnel.sold += 1;
    if (within(user.sessions, user.signedUpAt + DAY, user.signedUpAt + 2 * DAY)) row.returnedD1 += 1;
    if (within(user.sessions, user.signedUpAt + DAY, user.signedUpAt + 8 * DAY)) row.returnedD7 += 1;
    if (within(user.purchases, -Infinity, (first ?? user.signedUpAt) + 30 * DAY)) funnel.paid30d += 1;
    if (first != null) {
      funnel.priced += 1;
      row.activated += 1;
      if (first <= user.signedUpAt + 24 * HOUR) funnel.activated24h += 1;
      if (within(user.prices, first + DAY, first + 2 * DAY)) row.repeatD1 += 1;
      if (within(user.prices, first + DAY, first + 8 * DAY)) {
        row.repeatD7 += 1;
        funnel.secondPrice7d += 1;
      }
      if (within(user.prices, first + 8 * DAY, first + 31 * DAY)) row.repeatD30 += 1;
    }
    cohorts.set(week, row);
  }

  const shareEvents = events.filter((event) => event.name.startsWith("share_"));
  const visitor = (event: MetricEvent) => event.anonId ?? event.sessionId;
  const clickers = new Set(
    shareEvents.filter((event) => event.name === "share_signup_click").map(visitor).filter((id): id is string => Boolean(id)),
  );
  const share: ShareLoop = {
    views: shareEvents.filter((event) => event.name === "share_viewed").length,
    viewers: distinct(shareEvents.filter((event) => event.name === "share_viewed").map(visitor)),
    headerClickers: distinct(shareEvents.filter((event) => event.name === "share_header_click").map(visitor)),
    signupClickers: clickers.size,
    signupsFromShare: users.filter((user) => [...user.anonIds].some((id) => clickers.has(id))).length,
  };

  const paidUsers = (name: string) => distinct(events.filter((event) => event.name === name).map((event) => event.userId));
  const paid: PaidFunnel = {
    planViewers: paidUsers("upgrade_viewed"),
    checkoutStarters: paidUsers("checkout_started"),
    purchasers: paidUsers("checkout_completed"),
  };

  return {
    funnel,
    cohorts: [...cohorts.values()].sort((a, b) => b.week.localeCompare(a.week)),
    share,
    paid,
    events: events.length,
  };
}

export function percent(part: number, whole: number): string {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}
