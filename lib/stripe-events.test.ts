import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { claimStripeEvent, releaseStripeEvent } from "./stripe-events";

function signed(body: string, secret: string): string {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

test("a webhook event id is applied once and can be released after a failure", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "stripe-events-"));
  const saved = {
    path: process.env.STRIPE_EVENT_STORE_PATH,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
  process.env.STRIPE_EVENT_STORE_PATH = path.join(dir, "events.json");
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  try {
    assert.equal(await claimStripeEvent({ id: "evt_once", type: "checkout.session.completed", livemode: false }), "claimed");
    assert.equal(await claimStripeEvent({ id: "evt_once", type: "checkout.session.completed", livemode: false }), "duplicate");
    await releaseStripeEvent("evt_once");
    assert.equal(await claimStripeEvent({ id: "evt_once", type: "checkout.session.completed", livemode: false }), "claimed");
    await assert.rejects(() => claimStripeEvent({ id: "not-an-event" }), /Stripe event id is missing/);
  } finally {
    if (saved.path === undefined) delete process.env.STRIPE_EVENT_STORE_PATH;
    else process.env.STRIPE_EVENT_STORE_PATH = saved.path;
    if (saved.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = saved.url;
    if (saved.anon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = saved.anon;
    await rm(dir, { recursive: true, force: true });
  }
});

test("the webhook route checks the signature and acknowledges a duplicate event", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "stripe-webhook-"));
  const saved = {
    path: process.env.STRIPE_EVENT_STORE_PATH,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    key: process.env.STRIPE_SECRET_KEY,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  };
  process.env.STRIPE_EVENT_STORE_PATH = path.join(dir, "events.json");
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.STRIPE_SECRET_KEY = "sk_test_example";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_example";
  try {
    const route = (await import("../app/api/stripe/webhook/route")) as {
      POST?: (request: Request) => Promise<Response>;
      default?: { POST: (request: Request) => Promise<Response> };
    };
    const POST = route.POST || route.default?.POST;
    assert.equal(typeof POST, "function");
    const body = JSON.stringify({
      id: "evt_route_once",
      type: "checkout.session.completed",
      livemode: false,
      data: { object: { livemode: false } },
    });
    const headers = { "stripe-signature": signed(body, "whsec_example") };
    const first = await POST!(new Request("https://www.priceranger.app/api/stripe/webhook", { method: "POST", body, headers }));
    assert.equal(first.status, 200);
    const firstBody = (await first.json()) as { received?: boolean; duplicate?: boolean; mode?: string };
    assert.equal(firstBody.received, true);
    assert.equal(firstBody.duplicate, undefined);
    assert.equal(firstBody.mode, "test");
    const second = await POST!(new Request("https://www.priceranger.app/api/stripe/webhook", { method: "POST", body, headers: { "stripe-signature": signed(body, "whsec_example") } }));
    const secondBody = (await second.json()) as { received?: boolean; duplicate?: boolean };
    assert.equal(second.status, 200);
    assert.equal(secondBody.received, true);
    assert.equal(secondBody.duplicate, true);
    const rejected = await POST!(new Request("https://www.priceranger.app/api/stripe/webhook", { method: "POST", body, headers: { "stripe-signature": "t=1,v1=deadbeef" } }));
    assert.equal(rejected.status, 400);
  } finally {
    if (saved.path === undefined) delete process.env.STRIPE_EVENT_STORE_PATH;
    else process.env.STRIPE_EVENT_STORE_PATH = saved.path;
    if (saved.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = saved.url;
    if (saved.anon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = saved.anon;
    if (saved.key === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = saved.key;
    if (saved.secret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = saved.secret;
    await rm(dir, { recursive: true, force: true });
  }
});
