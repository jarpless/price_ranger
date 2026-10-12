import assert from "node:assert/strict";
import test from "node:test";

import { planLocally } from "./assistant/plan";
import { toolNeedsConfirm } from "./assistant/tools";
import { parseCsv, parsePriceCsv } from "./csv";
import { redactText, restoreText } from "./redact";
import { assistantMessageCap, PLAN_PRICES_CENTS, PLANS } from "./plans";
import { VERSION_LABEL, APP_VERSION } from "./version";

test("version label is the single Basecamp stamp", () => {
  assert.equal(APP_VERSION, "2.1.0");
  assert.equal(VERSION_LABEL, "v2.1 Basecamp");
});

test("assistant caps come from the plan config", () => {
  assert.equal(assistantMessageCap("free"), 10);
  assert.equal(PLANS.free.activeQuotes, 3);
  assert.equal(assistantMessageCap("plus"), 100);
  assert.equal(assistantMessageCap("pro"), 1000);
  assert.equal(assistantMessageCap("pass"), assistantMessageCap("pro"));
  assert.equal(PLAN_PRICES_CENTS.passOnce, 299);
  assert.equal(PLAN_PRICES_CENTS.plusMonth, 499);
  assert.equal(PLAN_PRICES_CENTS.plusYear, 3900);
  assert.equal(PLAN_PRICES_CENTS.proMonth, 1200);
});

test("redaction hides names, emails, phones, and addresses and can restore them", () => {
  const { text, tokens } = redactText(
    "Email maria@example.com about 12 Oak Street for Maria Alvarez. Call (415) 555-0199.",
    ["Maria Alvarez"],
  );
  assert.equal(text.includes("maria@example.com"), false);
  assert.equal(text.includes("Maria Alvarez"), false);
  assert.equal(text.includes("415"), false);
  assert.equal(text.includes("Oak Street"), false);
  assert.match(text, /\[email-\d+\]/);
  assert.match(text, /\[name-\d+\]/);
  assert.match(text, /\[phone-\d+\]/);
  assert.match(text, /\[address-\d+\]/);
  const restored = restoreText(text, tokens);
  assert.match(restored, /maria@example.com/);
  assert.match(restored, /Maria Alvarez/);
});

test("csv import accepts a header and skips a bad price", () => {
  const parsed = parseCsv('name,unit,price\n"Tear-off, haul",square,85\n');
  assert.deepEqual(parsed, [["name", "unit", "price"], ["Tear-off, haul", "square", "85"]]);
  const prices = parsePriceCsv("name,unit,price,sku\nRidge vent,each,40,\nBad,each,nope,\n");
  assert.equal(prices.rows.length, 1);
  assert.equal(prices.rows[0].unitPriceCents, 4000);
  assert.equal(prices.errors.length, 1);
});

test("local agent plan stays inside the app and flags deletes", () => {
  const steps = planLocally("Add a price called Ridge vent at 40 each", "/");
  assert.ok(steps);
  assert.equal(steps[1].name, "create_price");
  assert.equal(steps[1].args.price, "40");
  assert.equal(steps[1].needsConfirm, false);
  assert.equal(toolNeedsConfirm("delete_quote", { id: "abc" }), true);
  assert.equal(toolNeedsConfirm("navigate", { path: "https://example.com" }), true);
  assert.equal(planLocally("What is the total?", "/"), null);
});
