import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { brandWordIn } from "./brand-words";
import { BRANDS, currentSkuCode, isDefaultTradeCategory, PRODUCTS, ROOFING_CATEGORY, SKUS, skusForConnector } from "./catalog";
import { CONNECTORS } from "./connectors";
import { PRICE_CSV_TEMPLATE } from "./csv";
import { VOCABULARIES } from "./vocabulary";
import { editingMoney, formatUsd, parseDollarsToCents, parseQuantity } from "./money";
import { buildPresentation } from "./project";
import { createSessionValue, readSessionValue } from "./session";
import { autoSummary, customerSummary } from "./summary";
import type { ItemGroup, QuoteRecord } from "./types";

test("auto summary joins a few line items in plain language", () => {
  assert.equal(
    autoSummary([
      { name: "architectural shingles", quantity: 30, unit: "square" },
    ]),
    "Includes 30 squares of architectural shingles.",
  );
  assert.equal(
    autoSummary([
      { name: "architectural shingles", quantity: 30, unit: "square" },
      { name: "synthetic underlayment", quantity: 10, unit: "roll" },
    ]),
    "Includes 30 squares of architectural shingles and 10 rolls of synthetic underlayment.",
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
  assert.equal(editingMoney("$1,250"), "1250");
  assert.equal(editingMoney("$2,001,250"), "2001250");
});

test("the trades catalog is generic, handyman first, and keeps every saved sku id", () => {
  const shown = [
    ...BRANDS.map((brand) => brand.name),
    ...PRODUCTS.map((product) => `${product.name} ${product.category} ${product.description}`),
    ...SKUS.map((sku) => `${sku.name} ${sku.variation ?? ""} ${sku.skuCode} ${Object.values(sku.attributes).join(" ")}`),
    ...CONNECTORS.filter((connector) => connector.availability === "sample").map((connector) => `${connector.name} ${connector.summary} ${connector.access}`),
  ];
  for (const text of shown) assert.equal(brandWordIn(text), null, text);
  assert.equal(isDefaultTradeCategory(ROOFING_CATEGORY), false);
  assert.ok(isDefaultTradeCategory(PRODUCTS[0].category));
  assert.equal(CONNECTORS[0].slug, "handyman");
  assert.ok(skusForConnector("handyman").length >= 10);
  for (const name of ["Drywall patch", "Faucet replace", "Ceiling fan install", "Door rehang", "Outlet or switch swap", "TV mount", "Furniture assembly", "Gutter clean", "Service call", "Hourly labor"]) {
    assert.ok(SKUS.some((sku) => sku.name === name && sku.connectorSlug === "handyman"), name);
  }
  const firstCatalog = ["719c4821-6e7a-5be1-bdf0-dfc4965af742", "4b11f167-606f-5d24-9918-faf78ebe30ed", "573026b2-c096-537f-988f-3092b140540e", "fdb79d12-ac64-58cb-bc79-c16adc6913a5", "d0f27a9a-a5ff-5009-bcb5-f15661d3a57f", "cbb5035d-d157-568e-b64d-66b9dbfdf423", "23ccb4b1-fb93-51dd-b8af-83dd1d4cf599", "6f9ba51b-d289-5d40-9a79-b441ac8c42dc", "10508e7a-e6d2-52cb-913e-7c526fed0cac", "8151f24a-25a7-55d8-a293-c77bd1f34bcc", "91e51b90-767b-5b67-a530-66a0f8d66184", "73a32f9a-2d87-5d6a-adab-63db6045bd8f", "183b11e0-81e4-5d12-bc39-a7f1be75024e", "efe79e9f-3ab7-52bf-9a0e-b2934cf8a936", "d34f5ec1-f4a3-57fb-b107-f16f45dab6f9", "3d64de28-0e02-5669-99b8-79569799b2a8"];
  const migration = readFileSync(new URL("../supabase/migrations/20261017200000_generic_trades_catalog.sql", import.meta.url), "utf8");
  for (const id of firstCatalog) {
    const sku = SKUS.find((item) => item.id === id);
    assert.ok(sku, id);
    assert.equal(sku.connectorSlug === "handyman", false);
    assert.equal(PRODUCTS.find((item) => item.id === sku.productId)?.category, ROOFING_CATEGORY);
  }
  for (const row of [...PRODUCTS, ...SKUS]) assert.ok(migration.includes(row.id), row.id);
  assert.doesNotMatch(migration, /(insert into|update|delete from|alter table|drop table)\s+public\.(library_items|group_items|quotes|profiles)/i);
  assert.equal(currentSkuCode("GAF-THDZ"), "RS-ARCH");
  assert.equal(currentSkuCode("hm-trip"), "hm-trip");
  const trades = VOCABULARIES.trades;
  const tradesCopy = [trades.label, trades.blurb, trades.jobExample, ...trades.starters.map((item) => item.name)].join(" ");
  assert.doesNotMatch(tradesCopy, /roof|shingle|siding/i);
  assert.equal(brandWordIn(tradesCopy), null);
  assert.equal(brandWordIn(PRICE_CSV_TEMPLATE), null);
});

test("supplier cards keep the real store names", () => {
  // Owner decision: real stores users price materials against stay named. Only these cards are exempt.
  const names = new Map(CONNECTORS.map((connector) => [connector.slug, connector.name]));
  assert.equal(names.get("home-depot"), "Home Depot");
  assert.equal(names.get("lowes"), "Lowe's");
  assert.equal(names.get("abc-supply"), "ABC Supply");
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
        name: "architectural shingles",
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
  assert.match(snapshot.tiers[0].groups[0].summary, /30 squares of architectural shingles/);
  assert.equal(snapshot.tiers[0].recommended, true);
});
