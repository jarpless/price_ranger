import assert from "node:assert/strict";
import test from "node:test";

import { defaultDesktopPanel, parseDesktopPanel } from "./panel";

test("a desktop panel starts open and docked", () => {
  assert.deepEqual(defaultDesktopPanel(), { open: true, chrome: "docked" });
});

test("a saved choice keeps the panel closed or floating", () => {
  assert.deepEqual(parseDesktopPanel(JSON.stringify({ open: false, chrome: "floating" })), {
    open: false,
    chrome: "floating",
  });
  assert.deepEqual(parseDesktopPanel(JSON.stringify({ open: true, chrome: "docked" })), {
    open: true,
    chrome: "docked",
  });
});

test("a missing or broken choice falls through to the default", () => {
  assert.equal(parseDesktopPanel(null), null);
  assert.equal(parseDesktopPanel("nope"), null);
  assert.equal(parseDesktopPanel(JSON.stringify({ chrome: "docked" })), null);
  assert.deepEqual(parseDesktopPanel(JSON.stringify({ open: false, chrome: "side" })), {
    open: false,
    chrome: "docked",
  });
});
