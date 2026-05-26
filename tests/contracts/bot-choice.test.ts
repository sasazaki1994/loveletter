import test from "node:test";
import assert from "node:assert/strict";

import { chooseBotAction, chooseBotCard } from "@/lib/server/bot-service";

test("forced chooses forced card", () => {
  assert.equal(chooseBotCard(["marquise", "legate"]), "marquise");
  assert.equal(chooseBotCard(["vizier", "arbiter"]), "vizier");
});

test("without forced chooses lower rank", () => {
  assert.equal(chooseBotCard(["sentinel", "emissary"]), "sentinel");
});

test("chooseBotAction ignores handCount=0 target", () => {
  const d = chooseBotAction({ selfId: "s", hand: ["oracle", "warder"], players: [{ id: "s", isEliminated: false, shield: false, handCount: 2, discardPile: [] }, { id: "a", isEliminated: false, shield: false, handCount: 0, discardPile: [] }, { id: "b", isEliminated: false, shield: false, handCount: 1, discardPile: [] }] });
  assert.equal(d.targetId, "b");
});

test("shield/eliminated are excluded", () => {
  const d = chooseBotAction({ selfId: "s", hand: ["oracle", "emissary"], players: [{ id: "s", isEliminated: false, shield: false, handCount: 2, discardPile: [] }, { id: "e", isEliminated: true, shield: false, handCount: 1, discardPile: [] }, { id: "h", isEliminated: false, shield: true, handCount: 1, discardPile: [] }, { id: "ok", isEliminated: false, shield: false, handCount: 1, discardPile: [] }] });
  assert.equal(d.targetId, "ok");
});

test("guess rank avoids 1 and seen ranks", () => {
  const d = chooseBotAction({ selfId: "s", hand: ["sentinel", "oracle"], players: [{ id: "s", isEliminated: false, shield: false, handCount: 2, discardPile: [] }, { id: "t", isEliminated: false, shield: false, handCount: 1, discardPile: ["oracle", "duelist", "warder"] }] });
  assert.equal(d.cardId, "sentinel");
  assert.notEqual(d.guessedRank, 1);
  assert.notEqual(d.guessedRank, 2);
  assert.notEqual(d.guessedRank, 3);
  assert.notEqual(d.guessedRank, 4);
});

test("emissary is avoided when possible", () => {
  const d = chooseBotAction({ selfId: "s", hand: ["emissary", "oracle"], players: [{ id: "s", isEliminated: false, shield: false, handCount: 2, discardPile: [] }, { id: "t", isEliminated: false, shield: false, handCount: 1, discardPile: [] }] });
  assert.equal(d.cardId, "oracle");
});

test("duelist preferred with high remaining hand", () => {
  const d = chooseBotAction({ selfId: "s", hand: ["duelist", "vizier"], players: [{ id: "s", isEliminated: false, shield: false, handCount: 2, discardPile: [] }, { id: "t", isEliminated: false, shield: false, handCount: 1, discardPile: [] }] });
  assert.equal(d.cardId, "duelist");
});

test("duelist with low remaining hand keeps legal non-broken choice", () => {
  const d = chooseBotAction({ selfId: "s", hand: ["duelist", "warder"], players: [{ id: "s", isEliminated: false, shield: false, handCount: 2, discardPile: [] }, { id: "t", isEliminated: false, shield: false, handCount: 1, discardPile: [] }] });
  assert.ok(["duelist", "warder"].includes(d.cardId));
});

test("arbiter preferred with low remaining hand", () => {
  const d = chooseBotAction({ selfId: "s", hand: ["arbiter", "sentinel"], players: [{ id: "s", isEliminated: false, shield: false, handCount: 2, discardPile: [] }, { id: "t", isEliminated: false, shield: false, handCount: 1, discardPile: [] }] });
  assert.equal(d.cardId, "arbiter");
});

test("arbiter avoided with high remaining hand and safer card", () => {
  const d = chooseBotAction({ selfId: "s", hand: ["arbiter", "legate"], players: [{ id: "s", isEliminated: false, shield: false, handCount: 2, discardPile: [] }, { id: "t", isEliminated: false, shield: false, handCount: 1, discardPile: [] }] });
  assert.equal(d.cardId, "legate");
});
