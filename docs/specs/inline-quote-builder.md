# Inline quote builder

This PR is the quote itself. Photos, video, the chat panel, page tours, and the float-chat icon are owned by other work and are not part of this change.

The price screen (`/guide/:id`) edits the quote in the Total card. Adjust, nudge, Your price, and Add a line sit inside that card. Comparables stay below it.

## Data model

A sheet is JSON:

- `columns`: `{ id, label, type, formula?, countsInTotal? }`
- `rows`: `{ id, cells, formulas? }` where `cells` maps a column id to the typed text and `formulas` maps a column id to a cell formula
- Column types: `text`, `number`, `money`, `formula`
- A formula is a safe expression: numbers, column ids, `+ - * /`, parentheses, and a leading minus. There is no `eval`, no function calls, and no property access. The parser is `lib/guide/formula.ts`.
- A column formula applies to every cell in that column. A cell formula overrides it for that cell. An empty cell formula keeps the typed value. A formula that refers to itself shows “This formula refers to itself.”
- The Amount column is the line amount. Another calculated column is added into the total only when `countsInTotal` is true. New calculated columns start with that on. Older sheets without the flag stay unchanged.

A new or migrated quote starts as Item, Qty, Rate, and Amount, with Amount set to `qty * rate`. That projection is a `MoneyLine` (`name`, `quantity`, `unitPriceCents`), so `lineSettlement`, discounts, pass-through fees, and `linesAtAsking` stay the source of the total. A custom formula whose result is not qty × rate becomes quantity 1 and a unit price of the rounded cent result, and the same settlement runs on top.

The amount column on screen and on the share grid is the settled price, including a discount and Your price. The share total is `settledTotal` of those lines.

Rows and columns reorder by dragging a handle, or from a small move menu. Order is the array order. The total does not depend on order except that Your price still adjusts the first line, which is the existing asking-price rule.

## Storage and migration

`supabase/migrations/20261017120000_quote_builder.sql` adds `guide_quotes.sheet jsonb`. The app does not apply it and does not write that column.

Until that migration is applied in a separate database, the sheet is stored in the existing `sources` jsonb array as one `meta:sheet=` value. `visibleSources` already hides `meta:` entries. The builder is always on; the `QUOTE_BUILDER=0` switch was removed for launch. `QUOTE_BUILDER_SCHEMA=1` is reserved and unused.

Existing quotes have no sheet. The screen builds one from the current lines and only writes it when the seller edits.

## UI

The Total card contains:

- The total, range, and confidence
- A dense sheet edited in place. Row height is about 36px on desktop and 44px on a phone. Item names sit left, numbers sit right, and the total lines up under Amount.
- `+ Row` at the bottom of the grid and `+ Column` at the end of the header. The header renames in place and a compact popover sets the column type.
- On a phone the sheet stays inside the card. Item stays sticky, Amount stays in view, and extra columns scroll inside the sheet.
- A drag handle on each row and column, with a move menu for the keyboard.
- Adjust chips, the nudge slider, and Your price. Your price follows the sheet total before the save finishes.
- A sparkle on a calculated cell. It can explain the current formula or suggest a new one. The formula stays editable, for one cell or for the whole column.

The sparkle calls `POST /api/assistant/formula`, which uses the existing assistant model when a key is set. The response is a formula plus a plain explanation. The parser checks the formula before it is kept. With no model, the same route returns `suggestFormula` / `explainFormula`.

## Share page

`buyerSheet` attaches a `grid` of display cells when a sheet exists. The public page shows that grid. Line prices and the total still come from settlement, so the buyer sees the same amount the seller sees.

## Tests

`lib/guide/formula.test.ts` covers evaluation and rejected syntax. `lib/guide/sheet.test.ts` covers migration, discounts, Your price, a custom formula, reordering, cell formulas, circular references, calculated columns that count toward the total, and the sources round-trip.
