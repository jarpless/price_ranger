import assert from "node:assert/strict";
import test from "node:test";

import {
  accessLimits,
  applyDiscount,
  applyFee,
  nextStep,
  onboardingCopy,
  recordOnce,
  stepCopy,
  stepIndex,
  suggestPrice,
  TAP_AUDIT,
  variantForUser,
} from "./guide/flow";

test("experiment group stays on the same account", () => {
  const first = variantForUser("user-one");
  assert.equal(variantForUser("user-one"), first);
  assert.ok(first === "a" || first === "b");
});

test("group B gets a longer trial and more free quotes", () => {
  const start = "2026-10-01T00:00:00.000Z";
  const now = Date.parse("2026-10-10T00:00:00.000Z");
  const control = accessLimits("a", start, now);
  const experiment = accessLimits("b", start, now);
  assert.ok(experiment.trialDays > control.trialDays);
  assert.ok(experiment.quoteLimit > control.quoteLimit);
  assert.equal(control.expired, false);
  assert.ok(control.daysLeft > 0);
});

test("a trial that has run out is expired", () => {
  const start = "2026-01-01T00:00:00.000Z";
  const limits = accessLimits("a", start, Date.parse("2026-10-12T00:00:00.000Z"));
  assert.equal(limits.expired, true);
  assert.equal(limits.daysLeft, 0);
});

test("guided steps move in order and prices stay plain", () => {
  assert.equal(stepIndex("describe"), 0);
  assert.equal(nextStep("review"), "adjust");
  assert.equal(nextStep("sold"), null);
  const table = suggestPrice("Oak dining table", "item");
  assert.equal(table.cents, 18000);
  assert.equal(applyDiscount(18000, 10), 16200);
  assert.equal(applyFee(16200, 500), 16700);
  assert.equal(suggestPrice("something unusual", "check").cents, 2500);
});

test("a photo reaches a shareable price in three taps", () => {
  assert.equal(TAP_AUDIT.photoToShareablePrice.after, 3);
  assert.equal(TAP_AUDIT.photoToShareablePrice.before, 7);
  assert.equal(stepCopy("review", "item").primary, "Send");
  assert.equal(stepCopy("describe", "item").primary, "See price");
  assert.equal(stepCopy("sold", "job").primary, "Yes, got it");
});

test("onboarding copy differs by group and first-time events record once", () => {
  assert.notEqual(onboardingCopy("a").welcomeTitle, onboardingCopy("b").welcomeTitle);
  assert.equal(recordOnce("landing"), true);
  assert.equal(recordOnce("first_share"), true);
  assert.equal(recordOnce("path_chosen"), false);
  assert.equal(recordOnce("upgrade_viewed"), false);
});
