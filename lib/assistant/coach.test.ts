import assert from "node:assert/strict";
import test from "node:test";

import { COACH_PAGES, coachPage, dismissPage, parseDismissed, PAGE_TIPS } from "./coach";
import { parseTourMemory, rememberTour, shouldAutoStart, tourSteps } from "./tours";

test("key pages pick a short tip", () => {
  assert.equal(coachPage("/quotes/new"), "new-quote");
  assert.equal(coachPage("/quotes/abc"), "quote-builder");
  assert.equal(coachPage("/quotes/abc/present"), null);
  assert.equal(coachPage("/quotes/abc/tiers/t1"), null);
  assert.equal(coachPage("/settings"), "settings");
  assert.equal(coachPage("/settings/billing"), null);
  assert.equal(coachPage("/guide/abc", "share"), "share");
  assert.equal(coachPage("/guide/abc", "review"), null);
  assert.equal(coachPage("/"), null);
  for (const page of COACH_PAGES) {
    assert.ok(PAGE_TIPS[page].body.length < 140);
    assert.equal(PAGE_TIPS[page].id, page);
  }
});

test("a dismissed tip stays dismissed", () => {
  assert.deepEqual(parseDismissed(null), []);
  assert.deepEqual(parseDismissed("nope"), []);
  assert.deepEqual(parseDismissed(JSON.stringify(["settings", "nope", "share"])), ["settings", "share"]);
  assert.deepEqual(dismissPage(["settings"], "settings"), ["settings"]);
  assert.deepEqual(dismissPage(["settings"], "share"), ["settings", "share"]);
});

test("tours stay short and confirm before they act", () => {
  for (const page of COACH_PAGES) {
    for (const desktop of [true, false]) {
      const steps = tourSteps(page, desktop);
      assert.ok(steps.length >= 1 && steps.length <= 3);
      for (const step of steps) {
        assert.ok(step.spotlight);
        assert.ok(step.title.length < 32);
        assert.ok(step.missing);
        if (step.action) assert.match(step.action.confirm, /\?/);
      }
    }
  }
  const add = tourSteps("quote-builder", true)[0];
  assert.equal(add?.action?.requires, "group");
  assert.deepEqual(add?.action?.labels, ["Add"]);
  assert.equal(tourSteps("quote-builder", false)[0]?.spotlight, "quote-options");
});

test("a skipped or finished tour does not auto-start", () => {
  assert.equal(shouldAutoStart({}, "settings"), true);
  assert.deepEqual(parseTourMemory(JSON.stringify({ settings: "skipped", share: "done", other: "done" })), {
    settings: "skipped",
    share: "done",
  });
  const memory = rememberTour({}, "new-quote", "skipped");
  assert.equal(shouldAutoStart(memory, "new-quote"), false);
  assert.equal(shouldAutoStart(memory, "settings"), true);
  assert.deepEqual(parseTourMemory("nope"), {});
});
