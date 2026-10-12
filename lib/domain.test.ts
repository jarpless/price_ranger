import assert from "node:assert/strict";
import test from "node:test";

import { BRANDS, PRODUCTS, SKUS } from "./catalog";
import { CONNECTORS } from "./connectors";
import { formatUsd, parseDollarsToCents, parseQuantity } from "./money";
import { buildPresentation } from "./project";
import { createSessionValue, readSessionValue } from "./session";
import { autoSummary, customerSummary } from "./summary";
import type { ItemGroup, QuoteRecord } from "./types";

test("auto summary joins a few line items in plain language", () => {
  assert.equal(
    autoSummary([
      { name: "GAF Timberline HDZ shingles", quantity: 30, unit: "square" },
    ]),
    "Includes 30 squares of GAF Timberline HDZ shingles.",
  );
  assert.equal(
    autoSummary([
      { name: "GAF Timberline HDZ shingles", quantity: 30, unit: "square" },
      { name: "GAF FeltBuster underlayment", quantity: 10, unit: "roll" },
    ]),
    "Includes 30 squares of GAF Timberline HDZ shingles and 10 rolls of GAF FeltBuster underlayment.",
  );
  assert.match(autoSummary([
    { name: "A", quantity: 1, unit: "each" },
    { name: "B", quantity: 2, unit: "each" },
    { name: "C", quantity: 3, unit: "each" },
    { name: "D", quantity: 4, unit: "each" },
  ]), /and 1 more\.$/);
  assert.equal(autoSummary([]), "Add line items and a short description will appear here.");
});

test("an edited description replaces the automatic one", () => {
  const group = {
    summary: "A full architectural roof system.",
    summaryEdited: true,
    items: [{ name: "Shingles", quantity: 1, unit: "square" as const }],
  };
  assert.equal(customerSummary(group), "A full architectural roof system.");
  assert.match(customerSummary({ ...group, summaryEdited: false }), /^Includes /);
});

test("money parses and formats whole dollars and cents", () => {
  assert.equal(parseDollarsToCents("320"), 32000);
  assert.equal(parseDollarsToCents("$1,200.50"), 120050);
  assert.equal(parseDollarsToCents("2.5"), 250);
  assert.equal(parseDollarsToCents("1.555"), null);
  assert.equal(parseQuantity("30"), 30);
  assert.equal(parseQuantity("0"), null);
  assert.equal(formatUsd(32000), "$320");
  assert.equal(formatUsd(250), "$2.50");
  assert.equal(formatUsd(120050), "$1,200.50");
});

test("catalog ids are unique and every sku belongs to a real connector", () => {
  const ids = [...BRANDS, ...PRODUCTS, ...SKUS].map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const sku of SKUS) {
    const product = PRODUCTS.find((item) => item.id === sku.productId);
    assert.ok(product, sku.skuCode);
    assert.ok(BRANDS.some((brand) => brand.id === product?.brandId));
    const connector = CONNECTORS.find((item) => item.slug === sku.connectorSlug);
    assert.ok(connector && connector.availability !== "unavailable", sku.connectorSlug);
    assert.ok(sku.listPriceCents > 0);
  }
  assert.ok(CONNECTORS.some((connector) => connector.availability === "unavailable"));
});

test("session cookie round-trips the user id", async () => {
  const secret = "test-secret";
  const value = await createSessionValue("user-1", secret);
  assert.equal(await readSessionValue(value, secret), "user-1");
  assert.equal(await readSessionValue(value, "other-secret"), null);
  assert.equal(await readSessionValue("nope", secret), null);
});

test("presentation freezes group descriptions and totals", () => {
  const group: ItemGroup = {
    id: "g1",
    userId: "u",
    name: "Architectural roof",
    summary: "",
    summaryEdited: false,
    createdAt: "2026-10-12T00:00:00.000Z",
    items: [
      {
        id: "i1",
        groupId: "g1",
        libraryItemId: null,
        name: "GAF Timberline HDZ shingles",
        unit: "square",
        unitPriceCents: 32000,
        quantity: 30,
        sortOrder: 0,
      },
    ],
  };
  const quote: QuoteRecord = {
    id: "q1",
    userId: "u",
    title: "Roof replacement",
    customerName: "Maria Alvarez",
    status: "draft",
    createdAt: "2026-10-12T00:00:00.000Z",
    updatedAt: "2026-10-12T00:00:00.000Z",
    presentedSnapshot: null,
    tiers: [
      {
        id: "t1",
        quoteId: "q1",
        name: "Better",
        note: "",
        sortOrder: 0,
        recommended: true,
        groupIds: ["g1"],
      },
    ],
  };
  const snapshot = buildPresentation(quote, [group]);
  assert.equal(snapshot.tiers[0].totalCents, 960000);
  assert.match(snapshot.tiers[0].groups[0].summary, /30 squares of GAF Timberline HDZ shingles/);
  assert.equal(snapshot.tiers[0].recommended, true);
});
