import test from "node:test";
import assert from "node:assert/strict";

import { isSupportedVariantCardId } from "@/lib/game/variant-support";

test("variant support matrix", () => {
  assert.equal(isSupportedVariantCardId("feint"), true);
  assert.equal(isSupportedVariantCardId("wager"), true);
  assert.equal(isSupportedVariantCardId("marquise"), true);
  assert.equal(isSupportedVariantCardId("ambush"), false);
  assert.equal(isSupportedVariantCardId("insight"), false);
  assert.equal(isSupportedVariantCardId("standoff"), false);
});
