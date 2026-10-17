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

test("several lines name the item and the total after the change", () => {
  const described = priceChoices(
    [
      { id: "oak", name: "Oak dining table", cents: 18000 },
      { id: "ship", name: "Shipping", cents: 4500 },
    ],
    15000,
    22500,
  );
  assert.match(described.caption, /\$150/);
  assert.equal(described.choices[0]?.label, "Change Oak dining table from $180 to $150 (total $195)");
  assert.equal(described.choices[1]?.label, "Change Shipping from $45 to $150 (total $330)");
  assert.equal(described.choices[0]?.target, "line");
  assert.equal(described.choices[0]?.lineId, "oak");
  assert.equal(described.choices.some((choice) => /quote total/i.test(choice.label)), false);
});

test("one line names the item and the resulting total", () => {
  const described = priceChoices([{ id: "oak", name: "Oak dining table", cents: 18000 }], 15000, 18000);
  assert.equal(described.choices.length, 1);
  assert.equal(described.choices[0]?.target, "line");
  assert.equal(described.caption, "Change Oak dining table from $180 to $150 (total $150).");
});
