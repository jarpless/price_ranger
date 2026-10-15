import assert from "node:assert/strict";
import test from "node:test";

import { markdownBlocks, settleMarkdown } from "./markdown";
import { priceChoices } from "./price-target";

test("a numbered list stays one list when blank lines sit between the items", () => {
  const blocks = markdownBlocks("1. First tip\n\n2. Second tip\n\n3. Third tip");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]?.type, "ol");
  if (blocks[0]?.type !== "ol") return;
  assert.deepEqual(blocks[0].items, ["First tip", "Second tip", "Third tip"]);
});

test("an unfinished bold marker is closed so the asterisks stay hidden", () => {
  assert.equal(settleMarkdown("1. **Re"), "1. **Re**");
  assert.equal(settleMarkdown("3. *"), "3. ");
  const blocks = markdownBlocks("1. **Re");
  assert.equal(blocks[0]?.type, "ol");
  if (blocks[0]?.type !== "ol") return;
  assert.equal(blocks[0].items[0], "**Re**");
});

test("several lines make the confirm name the total and each line", () => {
  const described = priceChoices(
    [
      { id: "oak", name: "Oak dining table", cents: 18000 },
      { id: "ship", name: "Shipping", cents: 4500 },
    ],
    15000,
    22500,
  );
  assert.match(described.caption, /\$150/);
  assert.match(described.caption, /\$225/);
  assert.deepEqual(
    described.choices.map((choice) => choice.label),
    ["Set the quote total to $150", "Set Oak dining table to $150", "Set Shipping to $150"],
  );
  assert.equal(described.choices[0]?.target, "total");
  assert.equal(described.choices[1]?.lineId, "oak");
});

test("one line confirms the quote total", () => {
  const described = priceChoices([{ id: "oak", name: "Oak dining table", cents: 18000 }], 15000, 18000);
  assert.equal(described.choices.length, 1);
  assert.equal(described.choices[0]?.target, "total");
  assert.match(described.caption, /quote total/);
});
