import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { LANDING_EXAMPLES } from "./landing-examples";

const SPLASH_FILES = [
  "../components/landing.tsx",
  "../components/landing-stage.tsx",
  "../components/landing-art.tsx",
  "./landing-examples.ts",
];

/** Maker, label, and marketplace names that must not appear on the splash page. */
const BANNED = [
  "nintendo",
  "switch",
  "joy-con",
  "joy con",
  "iphone",
  "ipad",
  "apple",
  "samsung",
  "sony",
  "playstation",
  "xbox",
  "nike",
  "adidas",
  "ikea",
  "leica",
  "canon",
  "nikon",
  "fujifilm",
  "fuji",
  "trek",
  "specialized",
  "cannondale",
  "herman miller",
  "eames",
  "knoll",
  "ebay",
  "facebook",
];

function splashSource(): string {
  return SPLASH_FILES.map((file) => readFileSync(new URL(file, import.meta.url), "utf8")).join("\n");
}

test("splash examples are generic resale goods with a sold range", () => {
  assert.ok(LANDING_EXAMPLES.length >= 3);
  const seen = new Set<string>();
  for (const example of LANDING_EXAMPLES) {
    assert.equal(seen.has(example.id), false);
    seen.add(example.id);
    assert.match(example.name, /^[A-Z][a-z].+/);
    assert.match(example.price, /^\$\d+$/);
    assert.match(example.range, /^\$\d+–\$\d+$/);
    assert.equal(example.condition, "Good");
    assert.equal(example.confidence, "High confidence");
    assert.match(example.photoLabel, new RegExp(example.name, "i"));
    const low = Number(example.range.slice(1, example.range.indexOf("–")));
    const high = Number(example.range.slice(example.range.indexOf("–") + 2));
    const point = Number(example.price.slice(1));
    assert.ok(low < point && point < high);
  }
});

test("the splash page does not name a real brand", () => {
  const source = splashSource().toLowerCase();
  assert.doesNotMatch(source, /nintendo|joy-con|iphone/);
  for (const name of BANNED) {
    const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    assert.equal(pattern.test(source), false, name);
  }
});
