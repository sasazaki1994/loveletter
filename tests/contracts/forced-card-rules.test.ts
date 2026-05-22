import test from "node:test";
import assert from "node:assert/strict";

import { getForcedPlayableCard } from "@/lib/game/forced-card-rules";

test("forced rules: vizier pair", () => {
  assert.equal(getForcedPlayableCard(["vizier", "arbiter"]), "vizier");
  assert.equal(getForcedPlayableCard(["vizier", "legate"]), "vizier");
});

test("forced rules: marquise threshold", () => {
  assert.equal(getForcedPlayableCard(["marquise", "legate"]), "marquise");
  assert.equal(getForcedPlayableCard(["marquise", "arbiter"]), "marquise");
});

test("forced rules: non-forced hands", () => {
  assert.equal(getForcedPlayableCard(["marquise", "warder"]), null);
  assert.equal(getForcedPlayableCard(["oracle", "warder"]), null);
});
