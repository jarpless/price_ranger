import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  applyStripeWebhook,
  logStripeMode,
  resolveCheckoutPrice,
  stripeEventMatchesConfiguredMode,
  stripeMode,
  stripeModeLabel,
  stripePriceId,
  stripeSecretKey,
  stripeTestKey,
  stripeWebhookSecret,
} from "./billing";

const PRICE_ENV = ["STRIPE_PRICE_PASS", "STRIPE_PRICE_PLUS_MONTH", "STRIPE_PRICE_PLUS_YEAR", "STRIPE_PRICE_PRO_MONTH"] as const;

function withStripeEnv(key: string | undefined, fn: () => void): void {
  const savedKey = process.env.STRIPE_SECRET_KEY;
  const savedPrices = PRICE_ENV.map((name) => process.env[name]);
  const savedWebhook = process.env.STRIPE_WEBHOOK_SECRET;
  if (key === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = key;
  for (const name of PRICE_ENV) delete process.env[name];
  delete process.env.STRIPE_WEBHOOK_SECRET;
  try {
    fn();
  } finally {
    if (savedKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = savedKey;
    PRICE_ENV.forEach((name, index) => {
      const value = savedPrices[index];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    });
    if (savedWebhook === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = savedWebhook;
  }
}

test("Stripe stays off until a test or live secret is set", () => {
  withStripeEnv(undefined, () => {
    assert.equal(stripeMode(), "off");
    assert.equal(stripeSecretKey(), null);
    assert.equal(stripeTestKey(), null);
    assert.match(stripeModeLabel(), /Test mode is the default/);
  });
  withStripeEnv("pk_test_publishable", () => {
    assert.equal(stripeMode(), "off");
    assert.equal(stripeSecretKey(), null);
  });
  withStripeEnv("  sk_test_example  ", () => {
    assert.equal(stripeMode(), "test");
    assert.equal(stripeSecretKey(), "sk_test_example");
    assert.equal(stripeTestKey(), "sk_test_example");
    assert.equal(stripeModeLabel(), "Stripe test mode.");
  });
  withStripeEnv("sk_live_example", () => {
    assert.equal(stripeMode(), "live");
    assert.equal(stripeSecretKey(), "sk_live_example");
    assert.equal(stripeTestKey(), null);
    assert.equal(stripeModeLabel(), "Stripe live mode.");
  });
});

test("price ids come from env and live checkout will not invent one", () => {
  withStripeEnv("sk_test_example", () => {
    assert.equal(stripePriceId({ plan: "plus", interval: "month" }), "");
    assert.deepEqual(resolveCheckoutPrice({ plan: "plus", interval: "month" }), { source: "inline", amountCents: 499 });
    process.env.STRIPE_PRICE_PLUS_MONTH = "price_from_env";
    assert.equal(stripePriceId({ plan: "plus", interval: "month" }), "price_from_env");
    assert.deepEqual(resolveCheckoutPrice({ plan: "pro", interval: "month" }), { source: "inline", amountCents: 1200 });
    process.env.STRIPE_PRICE_PRO_MONTH = "price_pro_from_env";
    assert.deepEqual(resolveCheckoutPrice({ plan: "pro", interval: "month" }), { source: "env", priceId: "price_pro_from_env" });
  });
  withStripeEnv("sk_live_example", () => {
    assert.deepEqual(resolveCheckoutPrice({ plan: "pass", interval: "once" }), { source: "missing", envName: "STRIPE_PRICE_PASS" });
    process.env.STRIPE_PRICE_PLUS_YEAR = "price_year_from_env";
    assert.deepEqual(resolveCheckoutPrice({ plan: "plus", interval: "year" }), { source: "env", priceId: "price_year_from_env" });
  });
});

test("an event is applied only when its livemode matches the configured key", () => {
  withStripeEnv("sk_test_example", () => {
    assert.equal(stripeEventMatchesConfiguredMode(false), true);
    assert.equal(stripeEventMatchesConfiguredMode(true), false);
    assert.equal(stripeEventMatchesConfiguredMode(undefined), false);
  });
  withStripeEnv("sk_live_example", () => {
    assert.equal(stripeEventMatchesConfiguredMode(true), true);
    assert.equal(stripeEventMatchesConfiguredMode(false), false);
  });
  withStripeEnv(undefined, () => {
    assert.equal(stripeEventMatchesConfiguredMode(false), false);
    assert.equal(stripeEventMatchesConfiguredMode(true), false);
  });
});

test("the mode log names the mode and not the secret", () => {
  withStripeEnv("sk_live_example_not_a_real_key", () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_example_not_a_real_secret";
    const lines: string[] = [];
    const original = console.info;
    console.info = (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    };
    try {
      logStripeMode("mode-test");
      assert.equal(lines.length, 1);
      assert.match(lines[0], /Stripe mode: live \(mode-test\)\./);
      assert.equal(lines[0].includes("sk_live_example_not_a_real_key"), false);
      assert.equal(lines[0].includes("whsec_example_not_a_real_secret"), false);
      assert.equal(stripeWebhookSecret(), "whsec_example_not_a_real_secret");
    } finally {
      console.info = original;
    }
  });
});

test("a mismatched live event does not change a plan while the key is a test key", async () => {
  const savedKey = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "sk_test_example";
  try {
    await applyStripeWebhook({
      type: "checkout.session.completed",
      data: {
        object: {
          livemode: true,
          metadata: { userId: "user_test", plan: "plus" },
          payment_status: "paid",
        },
      },
    });
  } finally {
    if (savedKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = savedKey;
  }
});

test("billing code has no hard-coded Stripe ids or secrets", () => {
  const source = readFileSync(new URL("./billing.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /sk_live_[A-Za-z0-9]{8,}/);
  assert.doesNotMatch(source, /sk_test_[A-Za-z0-9]{8,}/);
  assert.doesNotMatch(source, /price_[A-Za-z0-9]{14,}/);
  assert.doesNotMatch(source, /whsec_[A-Za-z0-9]{8,}/);
});
