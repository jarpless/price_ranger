import assert from "node:assert/strict";
import test from "node:test";

import { placeTip } from "./place-tip";

const tip = { width: 256, height: 120 };
const viewport = { width: 1280, height: 800 };

test("places the tip below the icon when it fits", () => {
  const box = placeTip({ top: 40, left: 80, bottom: 84 }, tip, viewport);
  assert.equal(box.top, 92);
  assert.equal(box.left, 80);
  assert.equal(box.width, 256);
});

test("clamps the tip to the right edge", () => {
  const box = placeTip({ top: 40, left: 1200, bottom: 84 }, tip, viewport);
  assert.equal(box.left, 1280 - 256 - 8);
  assert.ok(box.left + box.width <= viewport.width - 8);
});

test("clamps the tip to the left edge", () => {
  const box = placeTip({ top: 40, left: -40, bottom: 84 }, tip, viewport);
  assert.equal(box.left, 8);
});

test("flips above the icon when the bottom edge would clip", () => {
  const box = placeTip({ top: 700, left: 80, bottom: 744 }, tip, viewport);
  assert.equal(box.top, 700 - 8 - 120);
  assert.ok(box.top >= 8);
  assert.ok(box.top + 120 <= viewport.height - 8);
});

test("stays inside a short viewport", () => {
  const box = placeTip({ top: 20, left: 8, bottom: 64 }, tip, { width: 200, height: 100 });
  assert.equal(box.width, 200 - 16);
  assert.equal(box.maxHeight, 100 - 16);
  assert.ok(box.top >= 8);
  assert.ok(box.left >= 8);
  assert.ok(box.left + box.width <= 200 - 8);
});
