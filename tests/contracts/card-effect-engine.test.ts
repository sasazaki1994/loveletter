import test from "node:test";
import assert from "node:assert/strict";

import { resolveCardEffect, type RulesPlayerSnapshot } from "@/lib/game/rules/card-effect-engine";
import type { CardId } from "@/lib/game/types";

function players(params: { actorHand: CardId[]; targetHand?: CardId[] }): RulesPlayerSnapshot[] {
  return [
    { id: "p1", nickname: "A", isSelf: true, isEliminated: false, shield: false, hand: params.actorHand },
    { id: "p2", nickname: "B", isSelf: false, isEliminated: false, shield: false, hand: params.targetHand ?? [] },
  ];
}

test("guess_eliminate: hit eliminates target", () => {
  const r = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "sentinel", actorHandAfterPlay: ["warder"], targetId: "p2", guessedRank: 4, players: players({ actorHand: ["warder"], targetHand: ["warder"] }), drawPileCount: 5 });
  assert.equal(r.effectActivated, true);
  assert.deepEqual(r.eliminatedPlayerIds, ["p2"]);
});

test("guess_eliminate: miss does not eliminate", () => {
  const r = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "sentinel", actorHandAfterPlay: ["warder"], targetId: "p2", guessedRank: 5, players: players({ actorHand: ["warder"], targetHand: ["warder"] }), drawPileCount: 5 });
  assert.deepEqual(r.eliminatedPlayerIds, []);
});

test("guess_eliminate: no target means no activation", () => {
  const r = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "sentinel", actorHandAfterPlay: ["warder"], guessedRank: 4, players: players({ actorHand: ["warder"] }), drawPileCount: 5 });
  assert.equal(r.effectActivated, false);
});

test("guess_reveal: never eliminates and exposes log semantics", () => {
  const hit = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "feint", actorHandAfterPlay: ["warder"], targetId: "p2", guessedRank: 4, players: players({ actorHand: ["warder"], targetHand: ["warder"] }), drawPileCount: 5 });
  const miss = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "wager", actorHandAfterPlay: ["warder"], targetId: "p2", guessedRank: 5, players: players({ actorHand: ["warder"], targetHand: ["warder"] }), drawPileCount: 5 });
  assert.deepEqual(hit.eliminatedPlayerIds, []);
  assert.deepEqual(miss.eliminatedPlayerIds, []);
  assert.match(hit.logSuffix, /公開/);
  assert.match(miss.logSuffix, /A は手札を公開/);
});

test("compare: higher rank survives", () => {
  const actorHigh = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "duelist", actorHandAfterPlay: ["arbiter"], targetId: "p2", players: players({ actorHand: ["arbiter"], targetHand: ["warder"] }), drawPileCount: 5 });
  const targetHigh = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "duelist", actorHandAfterPlay: ["warder"], targetId: "p2", players: players({ actorHand: ["warder"], targetHand: ["arbiter"] }), drawPileCount: 5 });
  const tie = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "duelist", actorHandAfterPlay: ["warder"], targetId: "p2", players: players({ actorHand: ["warder"], targetHand: ["warder"] }), drawPileCount: 5 });
  assert.deepEqual(actorHigh.eliminatedPlayerIds, ["p2"]);
  assert.deepEqual(targetHigh.eliminatedPlayerIds, ["p1"]);
  assert.deepEqual(tie.eliminatedPlayerIds, []);
});

test("shield: returns set_shield instruction", () => {
  const r = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "warder", actorHandAfterPlay: ["oracle"], players: players({ actorHand: ["oracle"] }), drawPileCount: 5 });
  assert.equal(r.instructions[0]?.type, "set_shield");
});

test("swap_hands: returns swap instruction", () => {
  const r = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "arbiter", actorHandAfterPlay: ["oracle"], targetId: "p2", players: players({ actorHand: ["oracle"], targetHand: ["warder"] }), drawPileCount: 5 });
  assert.equal(r.instructions[0]?.type, "swap_hands");
});

test("self_eliminate: emissary eliminates actor", () => {
  const r = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "emissary", actorHandAfterPlay: [], players: players({ actorHand: [] }), drawPileCount: 5 });
  assert.deepEqual(r.eliminatedPlayerIds, ["p1"]);
});
