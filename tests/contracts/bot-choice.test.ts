import test from "node:test";
import assert from "node:assert/strict";

import { chooseBotCard } from "@/lib/server/bot-service";

test("forced chooses forced card", () => {
  assert.equal(chooseBotCard(["marquise", "legate"]), "marquise");
  assert.equal(chooseBotCard(["vizier", "arbiter"]), "vizier");
});

test("vizier forced has priority over marquise", () => {
  assert.equal(chooseBotCard(["vizier", "marquise", "legate"]), "vizier");
});

test("without forced chooses lower rank", () => {
  assert.equal(chooseBotCard(["sentinel", "emissary"]), "sentinel");
  assert.equal(chooseBotCard(["oracle", "legate"]), "oracle");
});


test("empty hand throws", () => {
  assert.throws(() => chooseBotCard([]), /empty/i);
});
