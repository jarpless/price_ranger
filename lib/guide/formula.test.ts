import assert from "node:assert/strict";
import test from "node:test";

import { evaluateFormula, explainFormula, parseFormula, suggestFormula } from "./formula";

test("qty times rate multiplies and ignores spaces", () => {
  const result = evaluateFormula("qty * rate", { qty: 2, rate: 45 });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value, 90);
});

test("times and division happen before plus", () => {
  const result = evaluateFormula("qty * rate + 10", { qty: 2, rate: 5 });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value, 20);
});

test("parentheses and a leading minus are allowed", () => {
  const result = evaluateFormula("-(qty * rate) / (1 + markup)", { qty: 2, rate: 50, markup: 1 });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value, -50);
});

test("a formula cannot call functions or use eval", () => {
  assert.equal(parseFormula("eval(qty)").ok, false);
  assert.equal(parseFormula("qty(rate)").ok, false);
  assert.equal(parseFormula("process.exit()").ok, false);
  assert.equal(evaluateFormula("constructor", {}).ok, false);
});

test("divide by zero and an unknown column are errors", () => {
  const zero = evaluateFormula("rate / qty", { rate: 10, qty: 0 });
  assert.equal(zero.ok, false);
  const missing = evaluateFormula("hours * rate", { rate: 10 });
  assert.equal(missing.ok, false);
});

test("a suggestion names the columns it uses", () => {
  const suggested = suggestFormula(
    [
      { id: "item", label: "Item", type: "text" },
      { id: "hours", label: "Hours", type: "number" },
      { id: "rate", label: "Rate", type: "money" },
      { id: "markup", label: "Markup", type: "number" },
      { id: "amount", label: "Amount", type: "formula" },
    ],
    "amount",
  );
  assert.equal(suggested.formula, "hours * rate * (1 + markup / 100)");
  assert.match(explainFormula(suggested.formula, { hours: "Hours", rate: "Rate", markup: "Markup" }), /Hours times Rate/);
});
