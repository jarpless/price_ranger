import assert from "node:assert/strict";
import test from "node:test";

import { answerFromMarket, MARKET_REGRESSION, marketPrice } from "./market";

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

test("the assistant does not repeat a $40 Switch price", () => {
  const answer = answerFromMarket("used Nintendo Switch with dock and Joy-Cons", 4000);
  assert.ok(answer);
  assert.match(answer, /\$150/);
  assert.match(answer, /\$200/);
  assert.match(answer, /\$175/);
  assert.doesNotMatch(answer, /\$40/);
  assert.match(answer, /not using it/);
});
