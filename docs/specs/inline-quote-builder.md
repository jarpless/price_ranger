# Inline quote builder

This PR is the quote itself. Photos, video, the chat panel, page tours, and the float-chat icon are owned by other work and are not part of this change.

The price screen (`/guide/:id`) edits the quote in the Total card. Adjust, nudge, Your price, and Add a line sit inside that card. Comparables stay below it.

## Data model

A sheet is JSON:

- `columns`: `{ id, label, type, formula? }`
- `rows`: `{ id, cells }` where `cells` maps a column id to the typed text
- Column types: `text`, `number`, `money`, `formula`
- A formula is a safe expression: numbers, column ids, `+ - * /`, parentheses, and a leading minus. There is no `eval`, no function calls, and no property access. The parser is `lib/guide/formula.ts`.

A new or migrated quote starts as Item, Qty, Rate, and Amount, with Amount set to `qty * rate`. That projection is a `MoneyLine` (`name`, `quantity`, `unitPriceCents`), so `lineSettlement`, discounts, pass-through fees, and `linesAtAsking` stay the source of the total. A custom formula whose result is not qty × rate becomes quantity 1 and a unit price of the rounded cent result, and the same settlement runs on top.

The amount column on screen and on the share grid is the settled price, including a discount and Your price. The share total is `settledTotal` of those lines.

Rows move up or down. Order is the row array. The total does not depend on order except that Your price still adjusts the first line, which is the existing asking-price rule.

## Storage and migration

`supabase/migrations/20261017120000_quote_builder.sql` adds `guide_quotes.sheet jsonb`. The app does not apply it and does not write that column.

Until that migration is applied in a separate database, the sheet is stored in the existing `sources` jsonb array as one `meta:sheet=` value. `visibleSources` already hides `meta:` entries. Set `QUOTE_BUILDER=0` to keep the old controls outside the card. `QUOTE_BUILDER_SCHEMA=1` is reserved and unused.

Existing quotes have no sheet. The screen builds one from the current lines and only writes it when the seller edits.

## UI

The Total card contains:

- The total, range, and confidence
- A dense line table. Inputs are 16px. Extra columns scroll sideways at 390px
- Up and down controls on each row
- Add a line, one row at a time
- Add a column (text, number, money, or calculated)
- Adjust chips, the nudge slider, and Your price
- On a calculated column, a sparkle button

The sparkle calls `POST /api/assistant/formula`, which uses the existing assistant model when a key is set. The response is a formula plus a plain explanation. The parser checks the formula before it is kept. With no model, the same route returns `suggestFormula` / `explainFormula`. The seller can edit the formula in the card and apply it.

## Share page

`buyerSheet` attaches a `grid` of display cells when a sheet exists. The public page shows that grid. Line prices and the total still come from settlement, so the buyer sees the same amount the seller sees.

## Tests

`lib/guide/formula.test.ts` covers evaluation and rejected syntax. `lib/guide/sheet.test.ts` covers migration, discounts, Your price, a custom formula, reordering, and the sources round-trip.
