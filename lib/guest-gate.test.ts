import assert from "node:assert/strict";
import test from "node:test";

import {
  GUEST_PROBE_COOKIE,
  guestGate,
  hasCookie,
  isAutomatedClient,
  isGuestRateLimited,
  unsignedDestination,
  withParam,
  withoutParam,
} from "./guest-gate";

const chrome =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

test("bots and empty clients are not given a guest user", () => {
  assert.equal(isAutomatedClient(null), true);
  assert.equal(isAutomatedClient(""), true);
  assert.equal(isAutomatedClient("curl/8.7.1"), true);
  assert.equal(isAutomatedClient("facebookexternalhit/1.1"), true);
  assert.equal(isAutomatedClient("WhatsApp/2.23.20.0"), true);
  assert.equal(isAutomatedClient("Slackbot-LinkExpanding 1.0"), true);
  assert.equal(isAutomatedClient(chrome), false);
});

test("a plain browser get probes once, then creates only if the cookie came back", () => {
  assert.equal(guestGate({ userAgent: chrome, ready: false, hasProbe: false }), "probe");
  assert.equal(guestGate({ userAgent: chrome, ready: true, hasProbe: false }), "refuse");
  assert.equal(guestGate({ userAgent: chrome, ready: true, hasProbe: true }), "create");
  assert.equal(guestGate({ userAgent: "curl/8.7.1", ready: true, hasProbe: true }), "public");
});

test("a missed guest cookie or a bot lands on the public page", () => {
  assert.equal(unsignedDestination({ userAgent: chrome, guestSent: false }), "guest");
  assert.equal(unsignedDestination({ userAgent: chrome, guestSent: true }), "cookies");
  assert.equal(unsignedDestination({ userAgent: "curl/8.7.1", guestSent: false }), "login");
});

test("rate limit is a busy notice, not a guest error", () => {
  assert.equal(isGuestRateLimited({ message: "Request rate limit reached" }), true);
  assert.equal(isGuestRateLimited({ message: "over_request_rate_limit", code: "over_request_rate_limit" }), true);
  assert.equal(isGuestRateLimited({ status: 429, message: "nope" }), true);
  assert.equal(isGuestRateLimited({ message: "Anonymous sign-ins are disabled" }), false);
});

test("the one-shot marker is added and removed without dropping the rest of the path", () => {
  assert.equal(withParam("/start", "gs", "1"), "/start?gs=1");
  assert.equal(withParam("/?next=1", "gs", "1"), "/?next=1&gs=1");
  assert.equal(withoutParam("/?gs=1", "gs"), "/");
  assert.equal(hasCookie(`a=1; ${GUEST_PROBE_COOKIE}=1`, GUEST_PROBE_COOKIE), true);
  assert.equal(hasCookie("a=1", GUEST_PROBE_COOKIE), false);
});
