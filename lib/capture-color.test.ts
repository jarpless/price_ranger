import assert from "node:assert/strict";
import test from "node:test";

import { rewriteModernColor } from "./capture-color";

test("screenshot styles replace oklch and color-mix with a paintable color", () => {
  const painted = rewriteModernColor(
    "color: oklch(0.4 0.05 160); background: color-mix(in srgb, oklch(0.9 0.02 90), white)",
    (expr) => (expr.startsWith("color-mix") ? "#f3eee4" : "#1e4636"),
  );
  assert.equal(painted, "color: #1e4636; background: #f3eee4");
  assert.equal(rewriteModernColor("16px solid #1e4636", () => "#000"), "16px solid #1e4636");
});
