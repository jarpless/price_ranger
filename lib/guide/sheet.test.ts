import assert from "node:assert/strict";
import test from "node:test";

import { linesAtAsking, settledTotal } from "./pricing";
import { alignSheet, moveRow, sheetDisplay, sheetFromLines, sheetFromSources, sheetToMoneyLines, sheetTotalCents, sourcesWithSheet } from "./sheet";

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
