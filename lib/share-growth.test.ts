import assert from "node:assert/strict";
import test from "node:test";

import { SHARE_GROWTH_ACTION, shareGrowthOffer } from "./share-growth";

test("share links offer a free account and keep the download option hidden", () => {
  assert.equal(SHARE_GROWTH_ACTION, "signup");
  const offer = shareGrowthOffer("sheet-token");
  assert.equal(offer.action, "signup");
  assert.equal(offer.label, "Save these prices — free");
  assert.match(offer.href, /^\/signin\?reason=share&next=/);
  assert.match(decodeURIComponent(offer.href), /\/p\/sheet-token/);
  assert.doesNotMatch(offer.href, /\/install/);
  assert.doesNotMatch(offer.label, /Download the app/);
});

test("the share header links home with share UTM tags and is tracked once", async () => {
  const { readFileSync } = await import("node:fs");
  const { SHARE_HEADER_HREF } = await import("./share-growth");
  assert.equal(SHARE_HEADER_HREF, "https://www.priceranger.app/?ref=share&utm_source=share&utm_medium=quote_header");
  const page = readFileSync(new URL("../app/p/[token]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /href=\{SHARE_HEADER_HREF\}[\s\S]{0,120}data-track="share_header_click"/);
  assert.equal(page.match(/share_header_click/g)?.length, 1);
});
