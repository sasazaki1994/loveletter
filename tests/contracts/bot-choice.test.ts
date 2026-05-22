import test from "node:test";
import assert from "node:assert/strict";

import { chooseBotCard } from "@/lib/server/game-service";

test("bot chooses marquise when forced", () => {
  assert.equal(chooseBotCard(["marquise", "legate"]), "marquise");
  assert.equal(chooseBotCard(["marquise", "arbiter"]), "marquise");
});

test("bot chooses vizier when vizier rule applies", () => {
  assert.equal(chooseBotCard(["vizier", "arbiter"]), "vizier");
});

test("bot chooses lower rank normally", () => {
  assert.equal(chooseBotCard(["oracle", "legate"]), "oracle");
});
