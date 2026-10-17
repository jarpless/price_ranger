import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { brandWordIn } from "./brand-words";
import { suggestPrice } from "./guide/suggest";
import { LANDING_CATEGORIES, landingStartHref, newPriceHref } from "./landing-categories";

test("the landing page offers several industries, each with items one tap away", () => {
  assert.ok(LANDING_CATEGORIES.length >= 5);
  const ids = LANDING_CATEGORIES.map((category) => category.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(LANDING_CATEGORIES[0].id, "home-services");
  for (const category of LANDING_CATEGORIES) {
    assert.ok(category.items.length >= 3 && category.items.length <= 6, category.id);
    assert.match(category.sample.price, /^\$\d+$/);
    for (const item of category.items) {
      const href = landingStartHref(item.query);
      assert.ok(href.startsWith("/auth/guest?next="), href);
      const next = decodeURIComponent(href.slice("/auth/guest?next=".length));
      assert.equal(new URL(next, "https://x.test").searchParams.get("q"), item.query);
      assert.ok(next.length <= 200, next);
      const price = suggestPrice(item.query, "job");
      assert.notEqual(price.confidence, "low", item.query);
    }
  }
  assert.equal(newPriceHref(""), "/new");
  assert.equal(landingStartHref(""), "/auth/guest?next=%2Fnew");
});

test("landing categories, items, and copy name no brand or roofing example", () => {
  const source = ["../components/landing.tsx", "../components/landing-categories.tsx", "./landing-categories.ts"]
    .map((file) => readFileSync(new URL(file, import.meta.url), "utf8"))
    .join("\n");
  assert.equal(brandWordIn(source), null);
  assert.doesNotMatch(source, /roof|shingle/i);
  const landing = readFileSync(new URL("../components/landing.tsx", import.meta.url), "utf8");
  assert.match(landing, /<LandingCategories \/>/);
  assert.doesNotMatch(landing, /LandingStage/);
});

test("first-run previews and the photo stub name no brand", () => {
  const welcome = readFileSync(new URL("../components/welcome-slides.tsx", import.meta.url), "utf8");
  const previews = [...welcome.matchAll(/<p className="[^"]*">([^<{]+)<\/p>/g)].map((match) => match[1]).join(" ");
  assert.equal(brandWordIn(previews), null);
  const vision = readFileSync(new URL("./guide/vision.ts", import.meta.url), "utf8");
  const stub = vision.slice(vision.indexOf("if (stubAllowed())"), vision.indexOf("const provider"));
  assert.equal(brandWordIn(stub), null);
});
