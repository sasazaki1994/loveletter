import test from "node:test";
import assert from "node:assert/strict";

import {
  DISABLED_VARIANT_CARD_IDS,
  isDisabledVariantCardId,
  isSupportedVariantCardId,
  SUPPORTED_VARIANT_CARD_IDS,
} from "@/lib/game/variant-support";

test("variant support matrix for beta", () => {
  assert.deepEqual([...SUPPORTED_VARIANT_CARD_IDS], ["feint", "wager", "marquise"]);
  assert.deepEqual([...DISABLED_VARIANT_CARD_IDS], ["insight", "standoff", "ambush"]);

  assert.equal(isSupportedVariantCardId("feint"), true);
  assert.equal(isSupportedVariantCardId("wager"), true);
  assert.equal(isSupportedVariantCardId("marquise"), true);
  assert.equal(isSupportedVariantCardId("ambush"), false);
  assert.equal(isSupportedVariantCardId("insight"), false);
  assert.equal(isSupportedVariantCardId("standoff"), false);

  assert.equal(isDisabledVariantCardId("ambush"), true);
  assert.equal(isDisabledVariantCardId("insight"), true);
  assert.equal(isDisabledVariantCardId("standoff"), true);
});
