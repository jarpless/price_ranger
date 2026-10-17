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
