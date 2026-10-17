import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";

import { sampleSpread } from "../components/capture-shot";
import { rewriteModernColor } from "./capture-color";

test("screenshot styles replace oklch and color-mix with a paintable color", () => {
  const painted = rewriteModernColor(
    "color: oklch(0.4 0.05 160); background: color-mix(in srgb, oklch(0.9 0.02 90), white)",
    (expr) => (expr.startsWith("color-mix") ? "#f3eee4" : "#1e4636"),
  );
  assert.equal(painted, "color: #1e4636; background: #f3eee4");
  assert.equal(rewriteModernColor("16px solid #1e4636", () => "#000"), "16px solid #1e4636");
});

test("a blank main column is a flat sample, and feedback keeps a title without the preview toolbar", () => {
  assert.equal(sampleSpread([10, 12, 14]), 4);
  assert.ok(sampleSpread([10, 12, 14]) < 18);
  assert.ok(sampleSpread([20, 400, 90]) >= 18);
  const shot = readFileSync(new URL("../components/capture-shot.ts", import.meta.url), "utf8");
  const help = readFileSync(new URL("../components/shake-report.tsx", import.meta.url), "utf8");
  const mode = readFileSync(new URL("../components/feedback-mode.tsx", import.meta.url), "utf8");
  const composer = readFileSync(new URL("../components/feedback-composer.tsx", import.meta.url), "utf8");
  assert.match(shot, /container-type/);
  assert.match(shot, /data-app-shell/);
  assert.match(shot, /paintMainIfBlank/);
  assert.match(help, /\/feedback\/new\?shot=1/);
  assert.match(help, /stopImmediatePropagation/);
  assert.doesNotMatch(help, /data-feedback-label/);
  assert.doesNotMatch(mode, /data-feedback-label/);
  assert.match(composer, /Short title/);
  assert.match(composer, /form\.set\("title", title\)/);
});
