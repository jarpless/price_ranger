import assert from "node:assert/strict";
import test from "node:test";

import { linesAtAsking, settledTotal } from "./pricing";
import { alignSheet, cellFormulaError, moveColumn, moveRow, sheetDisplay, sheetFromLines, sheetFromSources, sheetToMoneyLines, sheetTotalCents, sourcesWithSheet } from "./sheet";

const oak = [
  { name: "Oak dining table", quantity: 1, unitPriceCents: 18000 },
  { name: "Delivery", quantity: 1, unitPriceCents: 1000 },
];

test("an existing quote migrates to qty times rate and keeps the total", () => {
  const sheet = sheetFromLines(oak);
  const lines = sheetToMoneyLines(sheet);
  assert.equal(settledTotal(lines, { percent: 0, includeFees: false }), 19000);
  assert.equal(sheetTotalCents(sheet, { percent: 0, includeFees: false }), 19000);
  assert.equal(lines[0].quantity, 1);
  assert.equal(lines[0].unitPriceCents, 18000);
});

test("a discount still skips delivery and matches the share math", () => {
  const sheet = sheetFromLines(oak);
  const adjustment = { percent: 10, includeFees: false };
  assert.equal(sheetTotalCents(sheet, adjustment), settledTotal(sheetToMoneyLines(sheet), adjustment));
  assert.equal(sheetTotalCents(sheet, adjustment), 17200);
  const grid = sheetDisplay(sheet, adjustment, null);
  assert.equal(grid.rows[0][3], "$162");
  assert.equal(grid.rows[1][3], "$10");
});

test("your price still wins, and the displayed amount matches", () => {
  const sheet = sheetFromLines(oak);
  const adjustment = { percent: 0, includeFees: false };
  const asking = 20000;
  assert.equal(sheetTotalCents(sheet, adjustment, asking), 20000);
  assert.equal(
    settledTotal(linesAtAsking(sheetToMoneyLines(sheet), asking, adjustment), adjustment),
    20000,
  );
  const grid = sheetDisplay(sheet, adjustment, asking);
  assert.equal(grid.rows[0][3], "$190");
  assert.equal(grid.rows[1][3], "$10");
});

test("a zero quantity does not charge the rate", () => {
  const sheet = sheetFromLines([{ name: "Labor", quantity: 2, unitPriceCents: 4000 }]);
  sheet.rows[0].cells.qty = "0";
  assert.equal(sheetToMoneyLines(sheet)[0].unitPriceCents, 0);
  assert.equal(sheetTotalCents(sheet, { percent: 0, includeFees: false }), 0);
});

test("a custom hours formula becomes the line total", () => {
  const sheet = sheetFromLines([{ name: "Labor", quantity: 1, unitPriceCents: 0 }]);
  sheet.columns.push({ id: "hours", label: "Hours", type: "number" });
  const amount = sheet.columns.find((column) => column.id === "amount");
  if (!amount) throw new Error("missing amount");
  amount.formula = "hours * rate";
  sheet.rows[0].cells.hours = "3";
  sheet.rows[0].cells.rate = "40";
  const lines = sheetToMoneyLines(sheet);
  assert.equal(lines[0].unitPriceCents, 12000);
  assert.equal(sheetTotalCents(sheet, { percent: 0, includeFees: false }), 12000);
});

test("rows move without changing the settled total", () => {
  const sheet = sheetFromLines(oak);
  const moved = moveRow(sheet, 0, 1);
  assert.equal(moved.rows[0].cells.item, "Delivery");
  assert.equal(moved.rows[1].cells.item, "Oak dining table");
  assert.equal(
    sheetTotalCents(moved, { percent: 0, includeFees: false }),
    sheetTotalCents(sheet, { percent: 0, includeFees: false }),
  );
  assert.equal(moveRow(sheet, 0, -1), sheet);
});

test("a delivery row keeps quantity and rate on the grid", () => {
  const sheet = sheetFromLines([{ name: "Delivery", quantity: 2, unitPriceCents: 1500 }]);
  const grid = sheetDisplay(sheet, { percent: 0, includeFees: false }, null);
  assert.deepEqual(grid.columns, ["Item", "Qty", "Rate", "Amount"]);
  assert.equal(grid.rows[0][0], "Delivery");
  assert.equal(grid.rows[0][1], "2");
  assert.equal(grid.rows[0][2], "15");
  assert.equal(grid.rows[0][3], "$30");
  assert.equal(sheetToMoneyLines(sheet)[0].quantity, 2);
  assert.equal(sheetToMoneyLines(sheet)[0].unitPriceCents, 1500);
});

test("a calculated column counts toward the total only when asked", () => {
  const sheet = sheetFromLines([{ name: "Labor", quantity: 2, unitPriceCents: 1500 }]);
  sheet.columns.push({ id: "labor", label: "Labor", type: "formula", formula: "qty * 5" });
  assert.equal(sheetTotalCents(sheet, { percent: 0, includeFees: false }), 3000);
  const labor = sheet.columns.find((column) => column.id === "labor");
  if (!labor) throw new Error("missing labor");
  labor.countsInTotal = true;
  assert.equal(sheetTotalCents(sheet, { percent: 0, includeFees: false }), 4000);
  const grid = sheetDisplay(sheet, { percent: 0, includeFees: false }, null);
  assert.equal(grid.columns[4], "Labor");
  assert.equal(grid.rows[0][4], "$10");
  assert.equal(grid.rows[0][1], "2");
});

test("a cell formula overrides the column and a loop is an error", () => {
  const sheet = sheetFromLines([{ name: "Labor", quantity: 2, unitPriceCents: 1500 }]);
  sheet.rows[0].formulas = { amount: "qty * 10" };
  assert.equal(sheetToMoneyLines(sheet)[0].unitPriceCents, 2000);
  const amount = sheet.columns.find((column) => column.id === "amount");
  const rate = sheet.columns.find((column) => column.id === "rate");
  if (!amount || !rate) throw new Error("missing column");
  amount.formula = "rate";
  rate.formula = "amount";
  delete sheet.rows[0].formulas;
  assert.equal(cellFormulaError(sheet, sheet.rows[0], "amount"), "This formula refers to itself.");
  assert.equal(cellFormulaError(sheet, sheet.rows[0], "rate"), "This formula refers to itself.");
});

test("columns move left and right", () => {
  const sheet = sheetFromLines([{ name: "Labor", quantity: 1, unitPriceCents: 1000 }]);
  const moved = moveColumn(sheet, 2, -1);
  assert.equal(moved.columns[1].id, "rate");
  assert.equal(moved.columns[2].id, "qty");
  assert.equal(moveColumn(sheet, 0, -1), sheet);
});

test("the sheet round-trips through sources and a nudge can update the rate", () => {
  const sheet = sheetFromLines(oak);
  const stored = sourcesWithSheet(["Similar prices", "meta:suggested=18000"], sheet);
  const read = sheetFromSources(stored);
  assert.ok(read);
  assert.equal(read?.rows[0].cells.item, "Oak dining table");
  const aligned = alignSheet(read!, [{ name: "Oak dining table", quantity: 1, unitPriceCents: 19000 }]);
  assert.equal(aligned.rows[0].cells.rate, "190");
  assert.equal(aligned.rows.length, 1);
});
