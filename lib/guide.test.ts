import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";

import { buildPricePdf, jpegSize, pdfFilename } from "./guide/pdf";
import { inspectPhoto, savePendingPhoto } from "./guide/photos";
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
import { buyerSheet, forPublic } from "./share";
import type { ItemGroup, QuoteRecord } from "./types";

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

test("the buyer sheet keeps the seller discount", () => {
  const sources = withAdjustment(["Similar small repairs"], { percent: 10, includeFees: false });
  const quote = {
    id: "quote-1",
    title: "Small roof repair",
    customerName: "Customer",
    tiers: [{ id: "tier-1", quoteId: "quote-1", name: "Price", note: "", sortOrder: 0, recommended: true, groupIds: ["group-1"] }],
  } as QuoteRecord;
  const groups = [
    {
      id: "group-1",
      items: [
        { name: "Small roof repair", quantity: 1, unitPriceCents: 85000 },
        { name: "Dumpster haul", quantity: 1, unitPriceCents: 45000 },
        { name: "Fee", quantity: 1, unitPriceCents: 7500 },
      ],
    },
  ] as ItemGroup[];
  const sheet = buyerSheet(quote, groups, { sources });
  assert.equal(settledTotal(
    groups[0].items.map((item) => ({ name: item.name, quantity: item.quantity, unitPriceCents: item.unitPriceCents })),
    adjustmentFromSources(sources),
  ), 129000);
  assert.equal(sheet.options[0].total, "$1,290");
  assert.equal(sheet.options[0].lines[0].detail, "$850 − 10% = $765");
  assert.equal(sheet.options[0].lines[0].price, "$765");
  assert.equal(sheet.options[0].lines[1].detail, "1 × $450");
  assert.equal(sheet.options[0].lines[2].price, "$75");
  const shared = forPublic({
    ...sheet,
    seller: "ada@example.com",
    note: "Email ada@example.com about the roof",
    subtitle: "ada@example.com",
  });
  assert.equal(shared.seller, undefined);
  assert.doesNotMatch(JSON.stringify(shared), /ada@example.com/);
  assert.equal(shared.options[0].lines.find((line) => line.name === "Dumpster haul")?.detail, "");
  assert.equal(shared.options[0].lines.some((line) => line.name === "Small roof repair"), true);
  assert.equal(shared.options[0].lines.find((line) => line.name === "Small roof repair")?.price, "$765");
  assert.equal(shared.photo, null);
  const kept = buildPricePdf({
    title: shared.title,
    subtitle: shared.subtitle,
    lines: shared.options[0].lines,
    total: shared.options[0].total,
    condition: "Good",
    range: "$1,000–$1,400",
  });
  const keptText = Buffer.from(kept).toString("latin1");
  assert.match(keptText, /Small roof repair/);
  assert.match(keptText, /Total \$1,290/);
  assert.match(keptText, /\$1,000/);
  const pdf = buildPricePdf({
    title: sheet.title,
    subtitle: sheet.subtitle,
    lines: sheet.options[0].lines,
    total: sheet.options[0].total,
  });
  assert.match(Buffer.from(pdf).toString("latin1"), /Total \$1,290/);
});

test("a photo that cannot be read does not throw, and HEIC is not treated as JPEG", async () => {
  const heic = new Uint8Array(32);
  heic.set([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
  assert.equal(inspectPhoto(heic, "image/jpeg"), "heic");
  const jpeg = new Uint8Array(64);
  jpeg[0] = 0xff;
  jpeg[1] = 0xd8;
  assert.equal(inspectPhoto(jpeg, "image/jpeg"), null);
  const huge = new Uint8Array(3_500_001);
  huge[0] = 0xff;
  huge[1] = 0xd8;
  assert.equal(inspectPhoto(huge, "image/jpeg"), "large");
  const previous = process.env.GUIDE_PHOTO_DIR;
  process.env.GUIDE_PHOTO_DIR = "/dev/null/price-ranger-readonly";
  await assert.doesNotReject(savePendingPhoto("user-photo", jpeg, "image/jpeg"));
  if (previous === undefined) delete process.env.GUIDE_PHOTO_DIR;
  else process.env.GUIDE_PHOTO_DIR = previous;
});

test("account delete reads the service role key on the server only", () => {
  const source = readFileSync(new URL("./account/delete.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/account/delete/route.ts", import.meta.url), "utf8");
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(route, /deleteSignedInAccount/);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY\s*=/);
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
  const branded = buildPricePdf({
    title: "Used iPhone 13 128GB unlocked",
    subtitle: "Good",
    condition: "Good",
    range: "$180–$230",
    lines: [
      { name: "Used iPhone 13 128GB unlocked", detail: "1 × $175", price: "$175" },
      { name: "Shipping", detail: "1 × $8", price: "$8" },
    ],
    total: "$183",
    comparables: [{ title: "iPhone 13 128GB unlocked", detail: "eBay · Good · 2026-09-16", price: "$205" }],
  });
  const brandedText = Buffer.from(branded).toString("latin1");
  assert.match(brandedText, /Price Ranger/);
  assert.match(brandedText, /\$175/);
  assert.match(brandedText, /Shipping/);
  assert.match(brandedText, /Comparables/);
  assert.match(brandedText, /iPhone 13 128GB unlocked/);
  assert.ok(branded.byteLength > 1200);
  const filename = pdfFilename("Used iPhone 13 128GB unlocked", "2026-10-14");
  assert.equal(filename, "price-ranger-used-iphone-13-128gb-unlocked-2026-10-14.pdf");
  assert.match(pdfFilename("A very long item title with many extra words that should stop cleanly", "2026-10-14"), /-[a-z0-9]+-2026-10-14\.pdf$/);
});

test("onboarding copy differs by group and first-time events record once", () => {
  assert.notEqual(onboardingCopy("a").welcomeTitle, onboardingCopy("b").welcomeTitle);
  assert.equal(recordOnce("landing"), true);
  assert.equal(recordOnce("first_share"), true);
  assert.equal(recordOnce("path_chosen"), false);
  assert.equal(recordOnce("upgrade_viewed"), false);
});
