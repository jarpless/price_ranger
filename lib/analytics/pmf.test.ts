import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { cleanProps, isClientEvent, isInternalEmail, isOpaqueId, PMF_EVENTS } from "./events";
import { summarize, weekOf, type MetricEvent } from "./metrics";

const base = Date.parse("2026-10-05T10:00:00.000Z");
const at = (hours: number) => new Date(base + hours * 3_600_000).toISOString();

function event(name: string, userId: string | null, hours: number, extra: Partial<MetricEvent> = {}): MetricEvent {
  return { userId, anonId: null, sessionId: null, name, props: {}, createdAt: at(hours), ...extra };
}

test("props drop personal-data keys and stay short", () => {
  const props = cleanProps({
    email: "a@b.com",
    customer_name: "Pat",
    note: "hi",
    channel: "link",
    tagline_choice: "b",
    confidence: "high",
    long: "x".repeat(500),
    nested: { a: 1 } as unknown as string,
    sold_cents: 1200,
    skip: null,
  });
  assert.deepEqual(Object.keys(props).sort(), ["channel", "confidence", "long", "sold_cents", "tagline_choice"]);
  assert.equal(props.long.length, 120);
  assert.equal(props.sold_cents, "1200");
});

test("only share and session events may come from the browser", () => {
  assert.ok(isClientEvent("share_viewed"));
  assert.ok(isClientEvent("session_started"));
  assert.ok(!isClientEvent("checkout_completed"));
  assert.ok(!isClientEvent("price_result_shown"));
  assert.ok(isOpaqueId("abcd1234abcd1234"));
  assert.ok(!isOpaqueId("x"));
  assert.ok(!isOpaqueId("has spaces in it"));
});

test("owner and test addresses are internal", () => {
  assert.ok(isInternalEmail("Owner@Shop.com", "owner@shop.com"));
  assert.ok(isInternalEmail("pat+test1@gmail.com", ""));
  assert.ok(isInternalEmail("qa@priceranger.app", ""));
  assert.ok(!isInternalEmail("pat@gmail.com", "owner@shop.com"));
  assert.ok(!isInternalEmail("", "owner@shop.com"));
});

test("every event name is allowed by the migration", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20261017200000_pmf_events.sql", import.meta.url), "utf8");
  for (const name of PMF_EVENTS) assert.match(sql, new RegExp(`'${name}'`), name);
});

test("weeks start on Monday in UTC", () => {
  assert.equal(weekOf("2026-10-05T10:00:00.000Z"), "2026-10-05");
  assert.equal(weekOf("2026-10-11T23:59:00.000Z"), "2026-10-05");
  assert.equal(weekOf("2026-10-12T00:00:00.000Z"), "2026-10-12");
});

test("activation, D1/D7/D30 repeat, and share attribution", () => {
  const events: MetricEvent[] = [
    // a: activated in 2h, priced again on day 1, returned on day 1, shared, bought
    event("signup", "a", 0),
    event("price_result_shown", "a", 2),
    event("price_result_shown", "a", 30),
    event("session_started", "a", 28, { anonId: "anon-a-123" }),
    event("quote_shared", "a", 3),
    event("upgrade_viewed", "a", 4),
    event("checkout_started", "a", 4),
    event("checkout_completed", "a", 5),
    // b: first price after 30h (not activated in 24h), repeat on day 10
    event("signup", "b", 0),
    event("first_price_generated", "b", 30),
    event("price_result_shown", "b", 30 + 24 * 10),
    // c: came from a share link, never priced
    event("share_viewed", null, -2, { anonId: "anon-c-123" }),
    event("share_viewed", null, -1, { anonId: "anon-c-123" }),
    event("share_header_click", null, -1, { anonId: "anon-c-123" }),
    event("share_signup_click", null, -1, { anonId: "anon-c-123" }),
    event("signup", "c", 0),
    event("session_started", "c", 0, { anonId: "anon-c-123" }),
    // internal account is ignored
    event("signup", "owner", 0, { props: { internal: "true" } }),
    event("price_result_shown", "owner", 1, { props: { internal: "true" } }),
    // excluded test account is ignored
    event("signup", "qa", 0),
  ];
  const summary = summarize(events, new Set(["qa"]));
  assert.deepEqual(summary.funnel, {
    signups: 3,
    priced: 2,
    activated24h: 1,
    shared: 1,
    sold: 0,
    secondPrice7d: 1,
    paid30d: 1,
  });
  assert.equal(summary.cohorts.length, 1);
  assert.deepEqual(summary.cohorts[0], {
    week: "2026-10-05",
    signups: 3,
    activated: 2,
    returnedD1: 1,
    returnedD7: 1,
    repeatD1: 1,
    repeatD7: 1,
    repeatD30: 1,
  });
  assert.deepEqual(summary.share, { views: 2, viewers: 1, headerClickers: 1, signupClickers: 1, signupsFromShare: 1 });
  assert.deepEqual(summary.paid, { planViewers: 1, checkoutStarters: 1, purchasers: 1 });
});
