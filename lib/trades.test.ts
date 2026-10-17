import assert from "node:assert/strict";
import test from "node:test";

import { allMenuLinks, buildMenu, folderOpenByDefault, menuActive } from "./menu";
import { TRADES, classifyQuote, itemStatus, newPriceHref, tradeById } from "./trades";

test("every trade becomes a folder with Price, Quotes, Sold, and Tools", () => {
  const trades = buildMenu({ guest: false }).find((section) => section.id === "trades");
  assert.ok(trades);
  assert.equal(trades.folders.length, TRADES.length);
  for (const folder of trades.folders) {
    assert.deepEqual(
      folder.views.map((view) => view.href),
      [`/trades/${folder.id}`, `/trades/${folder.id}/quotes`, `/trades/${folder.id}/sold`, `/trades/${folder.id}/tools`],
    );
    assert.ok(folder.links.length > 0);
  }
});

test("the menu has no duplicate destinations", () => {
  for (const guest of [true, false]) {
    const hrefs = allMenuLinks(buildMenu({ guest, owner: true })).map((link) => link.href);
    assert.equal(new Set(hrefs).size, hrefs.length);
  }
});

test("guests see no account-only links", () => {
  const hrefs = allMenuLinks(buildMenu({ guest: true })).map((link) => link.href);
  for (const href of ["/upgrade", "/settings", "/settings/billing", "/settings/delete"]) {
    assert.ok(!hrefs.includes(href), href);
  }
  assert.ok(!hrefs.includes("/admin/feedback"));
});

test("subcategories start a price with the search filled in", () => {
  const plumbing = tradeById("trades")?.subcategories.find((item) => item.id === "plumbing");
  assert.ok(plumbing);
  assert.equal(newPriceHref(plumbing), "/new?q=Plumbing%20repair");
});

test("handyman leads, and roofing is not the lead trade", () => {
  assert.equal(TRADES[0].id, "home-services");
  const trades = tradeById("trades")!.subcategories.map((item) => item.id);
  assert.notEqual(trades[0], "roofing");
  assert.equal(trades.at(-1), "roofing");
});

const BRANDS = ["nintendo", "switch oled", "playstation", "ps5", "xbox", "iphone", "ipad", "airpods", "macbook", "apple", "samsung", "ikea", "dewalt", "milwaukee", "jordan", "yeezy", "pokemon", "goodwill", "nike"];

test("trade copy and keywords name no brands", () => {
  const words = TRADES.flatMap((trade) => [
    trade.label,
    ...trade.subcategories.flatMap((item) => [item.label, item.query, ...item.keywords]),
    ...trade.tools.flatMap((tool) => [tool.label, tool.blurb]),
  ]).map((word) => word.toLowerCase());
  for (const word of words) {
    for (const brand of BRANDS) assert.ok(!new RegExp(`(^|[^a-z0-9])${brand}([^a-z0-9]|$)`).test(word), `${brand} in "${word}"`);
  }
});

test("active rows match the page and never a prefilled search", () => {
  assert.equal(menuActive("/", { href: "/", label: "Home" }), true);
  assert.equal(menuActive("/items", { href: "/", label: "Home" }), false);
  assert.equal(menuActive("/items/drafts", { href: "/items", label: "All", exact: true }), false);
  assert.equal(menuActive("/items/drafts", { href: "/items/drafts", label: "Drafts", exact: true }), true);
  assert.equal(menuActive("/new", { href: "/new?q=Roofing", label: "Roofing" }), false);
  assert.equal(menuActive("/guide/abc", { href: "/new", label: "New price" }), true);
  assert.equal(menuActive("/settings/billing", { href: "/settings", label: "Settings", exact: true }), false);
});

test("the user's trade folder opens by default, the current trade wins", () => {
  const folders = buildMenu({ guest: false }).find((section) => section.id === "trades")!.folders;
  const trades = folders.find((folder) => folder.id === "trades")!;
  const selling = folders.find((folder) => folder.id === "selling")!;
  assert.equal(folderOpenByDefault(trades, "/", "trades"), true);
  assert.equal(folderOpenByDefault(selling, "/", "trades"), false);
  assert.equal(folderOpenByDefault(selling, "/trades/selling/sold", "trades"), true);
  assert.equal(folderOpenByDefault(trades, "/trades/selling", "trades"), false);
});

test("quotes are filed under a trade by keyword, then by path", () => {
  assert.equal(classifyQuote({ description: "Game console with dock", path: "item" })?.subcategory?.id, "games");
  assert.equal(classifyQuote({ description: "Replace a light switch", path: "job" })?.subcategory?.id, "electrical");
  assert.equal(classifyQuote({ description: "Mount a 65in TV", path: "job" })?.trade.id, "home-services");
  assert.equal(classifyQuote({ description: "Deck repair, 12 boards", path: "job" })?.subcategory?.id, "carpentry");
  assert.equal(classifyQuote({ description: "Fix a drywall patch", path: "job" })?.subcategory?.id, "repairs");
  assert.equal(classifyQuote({ description: "Spare part", path: "check" }), null);
  assert.equal(classifyQuote({ description: "Laptop, 13in", path: "item" })?.subcategory?.id, "electronics");
  assert.equal(classifyQuote({ description: "Something odd", path: "item" })?.trade.id, "selling");
  assert.equal(classifyQuote({ description: "", path: "job" })?.trade.id, "trades");
});

test("item status follows sold, shared, priced, then draft", () => {
  assert.equal(itemStatus({ outcome: "sold", sharedAt: "x", finishedAt: "x" }), "sold");
  assert.equal(itemStatus({ outcome: "not_yet", sharedAt: "x", finishedAt: "x" }), "shared");
  assert.equal(itemStatus({ outcome: null, sharedAt: null, finishedAt: "x" }), "priced");
  assert.equal(itemStatus({ outcome: null, sharedAt: null, finishedAt: null }), "drafts");
});
