import assert from "node:assert/strict";
import test from "node:test";

import { answerFromMarket, comparableAnchorCents, comparableAnchorFromRange, comparablesForTitle, MARKET_REGRESSION, marketPrice, pictureFor, priceFarFromRange } from "./market";

test("a bare Nintendo Switch is the docked model, not the OLED", () => {
  const quote = marketPrice("Nintendo Switch");
  assert.ok(quote);
  assert.equal(quote.variantId, "standard");
  assert.equal(quote.cents, 17500);
  assert.notEqual(quote.cents, 24000);
});

test("an OLED television is not priced as a Switch", () => {
  assert.equal(marketPrice("OLED TV"), null);
  assert.equal(marketPrice("Samsung OLED television"), null);
});

test("a used Switch with dock lands in the sold range", () => {
  const quote = marketPrice("used Nintendo Switch with dock and Joy-Cons");
  assert.ok(quote);
  assert.ok(quote.cents >= 15000 && quote.cents <= 20000);
  assert.ok(quote.lowCents >= 15000 && quote.highCents <= 20000);
  assert.equal(quote.condition, "good");
  assert.ok(quote.confidence === "medium" || quote.confidence === "high");
  assert.ok(quote.comparables.length >= 3);
  assert.equal(quote.comparables.every((comp) => comp.url.startsWith("https://") && comp.soldAt && !comp.listed), true);
});

test("regression items stay inside their sold ranges", () => {
  for (const item of MARKET_REGRESSION) {
    const quote = marketPrice(item.description);
    assert.ok(quote, item.description);
    assert.ok(quote.cents >= item.low && quote.cents <= item.high, item.description);
    assert.ok(quote.comparables.length >= 3, item.description);
  }
});

test("comparables draw the kind of item, not one phone for everything", () => {
  const deck = marketPrice("Nintendo Switch");
  const phone = marketPrice("iPhone 13 128GB unlocked");
  const buds = marketPrice("AirPods Pro 2");
  const laptop = marketPrice("MacBook Air M1");
  assert.ok(deck && phone && buds && laptop);
  const thumbs = [deck, phone, buds, laptop].map((quote) => quote.comparables[0]?.thumbnail || "");
  assert.equal(new Set(thumbs).size, 4);
  assert.ok(thumbs.every((thumb) => thumb.startsWith("data:image/svg+xml")));
});

test("a table without a catalog listing still has sold comps and a picture", () => {
  const comps = comparablesForTitle("Oak dining table", 18000);
  assert.equal(comps.length, 4);
  assert.ok(comps.every((comp) => comp.title.includes("Oak dining table") && comp.source === "eBay" && comp.url.includes("LH_Sold=1")));
  assert.equal(new Set(comps.map((comp) => comp.priceCents)).size, 4);
  const picture = pictureFor("Oak dining table");
  assert.ok(picture.startsWith("data:image/svg+xml"));
  assert.notEqual(picture, pictureFor("iPhone 13"));
});

test("sold comps stay on the lookup when the asking price changes", () => {
  const lookup = comparableAnchorCents({ suggestedCents: 18000, lowCents: 14400, highCents: 21600 });
  assert.equal(lookup, 18000);
  const typed = 125000;
  assert.equal(comparableAnchorCents({ lookupCents: null, suggestedCents: 18000, lowCents: 14400, highCents: 21600 }), 18000);
  assert.notEqual(lookup, typed);
  const comps = comparablesForTitle("Oak dining table", lookup);
  assert.deepEqual(
    comps.map((comp) => comp.priceCents),
    [15500, 16900, 19100, 20500],
  );
  assert.equal(comparableAnchorFromRange("$144–$216"), 18000);
  assert.equal(comparableAnchorFromRange(""), 0);
  const catalog = marketPrice("Nintendo Switch");
  assert.ok(catalog);
  assert.ok(catalog.comparables.every((comp) => comp.priceCents < 40000));
});

test("a price far outside the sold range is called out", () => {
  assert.equal(priceFarFromRange(125000, 15000, 20000), true);
  assert.equal(priceFarFromRange(17500, 15000, 20000), false);
  assert.equal(priceFarFromRange(22000, 15000, 20000), false);
  assert.equal(priceFarFromRange(5000, 15000, 20000), true);
  assert.equal(priceFarFromRange(null, 15000, 20000), false);
});

test("the assistant does not repeat a $40 Switch price", () => {
  const answer = answerFromMarket("used Nintendo Switch with dock and Joy-Cons", 4000);
  assert.ok(answer);
  assert.match(answer, /\$150/);
  assert.match(answer, /\$200/);
  assert.match(answer, /\$175/);
  assert.doesNotMatch(answer, /\$40/);
  assert.match(answer, /not using it/);
});
