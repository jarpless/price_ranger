import assert from "node:assert/strict";
import test from "node:test";

import { screenAnswer, type ScreenContext } from "./screen";

const home: ScreenContext = { pathname: "/", planName: "Free", quote: null };

const priced: ScreenContext = {
  pathname: "/guide/abc?step=review",
  planName: "Free",
  quote: {
    description: "Nintendo Switch",
    priceCents: 17500,
    step: "review",
    note: "Sold listings cluster around $175.",
    condition: "Good",
    range: "$150–$200",
  },
};

const shared: ScreenContext = {
  pathname: "/guide/abc?step=share",
  planName: "Plus",
  quote: { ...priced.quote!, step: "share" },
};

test("how to share on Home names Copy link, Share, and Download PDF", () => {
  const answer = screenAnswer("How do I share a quote?", home);
  assert.ok(answer);
  assert.match(answer, /Copy link/);
  assert.match(answer, /Share/);
  assert.match(answer, /Download PDF/);
  assert.doesNotMatch(answer, /step \d/);
});

test("how to share on the link screen stays on that screen", () => {
  const answer = screenAnswer("How do I share this?", shared);
  assert.match(answer || "", /Copy link/);
  assert.match(answer || "", /Nintendo Switch/);
  assert.doesNotMatch(answer || "", /step \d/);
});

test("changing the price names the chips and slider", () => {
  const answer = screenAnswer("How do I change the price?", priced);
  assert.match(answer || "", /condition chip/);
  assert.match(answer || "", /slider/);
  assert.match(answer || "", /Save price/);
});

test("mark sold asks for the amount", () => {
  const answer = screenAnswer("How do I mark it sold?", shared);
  assert.match(answer || "", /Mark sold/);
  assert.match(answer || "", /Yes, sold/);
});

test("plan questions name the current plan", () => {
  const answer = screenAnswer("What plan am I on?", home);
  assert.match(answer || "", /Free/);
  assert.match(answer || "", /\/upgrade/);
  assert.doesNotMatch(answer || "", /step \d/);
});

test("delete points at Settings", () => {
  const answer = screenAnswer("How do I delete my account?", home);
  assert.match(answer || "", /Delete account/);
  assert.match(answer || "", /DELETE/);
});

test("a photo starts from New price", () => {
  const answer = screenAnswer("How do I add a photo?", home);
  assert.match(answer || "", /New price/);
  assert.match(answer || "", /photo/);
});

test("cancel points at Manage billing", () => {
  const answer = screenAnswer("How do I cancel my subscription?", { ...home, planName: "Plus" });
  assert.match(answer || "", /Plus/);
  assert.match(answer || "", /Manage billing/);
  assert.match(answer || "", /\/settings\/billing/);
});

test("a price on screen includes condition and range", () => {
  const answer = screenAnswer("What is this worth?", priced);
  assert.match(answer || "", /\$175/);
  assert.match(answer || "", /Good/);
  assert.match(answer || "", /\$150–\$200/);
  assert.doesNotMatch(answer || "", /step \d/);
});

test("walk me through does not recite a step script", () => {
  const answer = screenAnswer("Walk me through this step", priced);
  assert.ok(answer);
  assert.doesNotMatch(answer, /step \d of \d/);
  assert.match(answer, /Send|condition chip/);
});
