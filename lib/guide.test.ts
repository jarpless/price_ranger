import assert from "node:assert/strict";
import test from "node:test";

import { buildPricePdf, jpegSize } from "./guide/pdf";
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
import {
  adjustmentFromSources,
  isPassThrough,
  lineSettlement,
  looksLikeFilename,
  settledTotal,
  withAdjustment,
} from "./guide/pricing";
import { isMissingSchema } from "./guide/schema";
import { explainPrice } from "./guide/help";

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

test("a missing guide table is recognized and other errors are not", () => {
  assert.equal(isMissingSchema({ code: "PGRST205", message: "Could not find the table 'public.guide_users' in the schema cache" }), true);
  assert.equal(isMissingSchema({ code: "42P01", message: 'relation "guide_users" does not exist' }), true);
  assert.equal(isMissingSchema({ code: "42703", message: 'column "feedback_enabled" does not exist' }), true);
  assert.equal(isMissingSchema({ message: "Could not find the 'cost_cents' column of 'group_items' in the schema cache" }), true);
  assert.equal(isMissingSchema({ code: "42501", message: "new row violates row-level security policy" }), false);
  assert.equal(isMissingSchema(null), false);
});

test("a photo reaches a shareable price in three taps", () => {
  assert.equal(TAP_AUDIT.photoToShareablePrice.after, 3);
  assert.equal(TAP_AUDIT.photoToShareablePrice.before, 7);
  assert.equal(stepCopy("review", "item").primary, "Send");
  assert.equal(stepCopy("describe", "item").primary, "See price");
  assert.equal(stepCopy("sold", "job").primary, "Yes, got it");
});

test("a small roof repair is not priced as a full roof", () => {
  const repair = suggestPrice("Small roof repair, one story, asphalt shingles", "job");
  assert.equal(repair.cents, 85000);
  assert.match(repair.note, /not a full replacement/);
  const full = suggestPrice("Full roof replacement, asphalt shingles", "job");
  assert.equal(full.cents, 850000);
  assert.equal(suggestPrice("Used Trek mountain bike, 21 speed", "item").cents, 12000);
  assert.equal(suggestPrice("KitchenAid stand mixer", "item").cents, 18000);
});

test("a discount skips pass-through fees unless asked", () => {
  const lines = [
    { name: "Small roof repair", quantity: 1, unitPriceCents: 850000 },
    { name: "Dumpster haul", quantity: 1, unitPriceCents: 45000 },
  ];
  assert.equal(isPassThrough("Dumpster haul"), true);
  assert.equal(isPassThrough("Fee"), true);
  const workOnly = { percent: 10, includeFees: false };
  assert.equal(settledTotal(lines, workOnly), 765000 + 45000);
  assert.equal(lineSettlement(lines[1], workOnly).detail, "1 × $450");
  assert.equal(lineSettlement(lines[0], workOnly).detail, "$8,500 − 10% = $7,650");
  const all = { percent: 10, includeFees: true };
  assert.equal(lineSettlement(lines[1], all).cents, 40500);
  const stored = withAdjustment(["Similar prices"], workOnly);
  assert.deepEqual(adjustmentFromSources(stored), workOnly);
});

test("a filename is not a title and a price question stays plain", () => {
  assert.equal(looksLikeFilename("IMG_4821.jpg"), true);
  assert.equal(looksLikeFilename("KitchenAid stand mixer"), false);
  assert.match(onboardingCopy("a").stepsBody, /check the price/);
  assert.doesNotMatch(onboardingCopy("a").stepsBody, /Five short/);
  const answer = explainPrice("Why this price, and what should I do next?", {
    description: "Lawn mow for a small yard",
    priceCents: 4500,
    note: "A typical visit for a small lawn.",
  });
  assert.match(answer || "", /\$45/);
  assert.doesNotMatch(answer || "", /price record|quote quote/);
});

test("a price sheet becomes a real PDF", () => {
  const jpeg = Uint8Array.from([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9,
  ]);
  assert.deepEqual(jpegSize(jpeg), { width: 1, height: 1 });
  const pdf = buildPricePdf({
    title: "KitchenAid stand mixer",
    subtitle: "Buyer",
    lines: [{ name: "KitchenAid stand mixer", detail: "1 × $80", price: "$80" }],
    total: "$80",
    jpeg,
  });
  const text = Buffer.from(pdf).toString("latin1");
  assert.match(text, /^%PDF-1\.4/);
  assert.match(text, /%%EOF/);
  assert.match(text, /KitchenAid stand mixer/);
});

test("onboarding copy differs by group and first-time events record once", () => {
  assert.notEqual(onboardingCopy("a").welcomeTitle, onboardingCopy("b").welcomeTitle);
  assert.equal(recordOnce("landing"), true);
  assert.equal(recordOnce("first_share"), true);
  assert.equal(recordOnce("path_chosen"), false);
  assert.equal(recordOnce("upgrade_viewed"), false);
});
