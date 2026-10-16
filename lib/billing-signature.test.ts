import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

import { verifyStripeSignature } from "./billing";

test("a Stripe webhook signature matches the raw body", () => {
  const secret = "whsec_test";
  const body = "{\"type\":\"checkout.session.completed\"}";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  assert.equal(verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, secret), true);
  assert.equal(verifyStripeSignature(body, `t=${timestamp},v1=deadbeef`, secret), false);
  assert.equal(verifyStripeSignature(body, `t=1,v1=${signature}`, secret), false);
});
