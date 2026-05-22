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

test("Sentinel contract", () => {
  const hit = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "sentinel", actorHandAfterPlay: ["warder"], targetId: "p2", guessedRank: 4, players: players({ actorHand: ["warder"], targetHand: ["warder"] }), drawPileCount: 5 });
  const miss = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "sentinel", actorHandAfterPlay: ["warder"], targetId: "p2", guessedRank: 5, players: players({ actorHand: ["warder"], targetHand: ["warder"] }), drawPileCount: 5 });
  const noTarget = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "sentinel", actorHandAfterPlay: ["warder"], guessedRank: 4, players: players({ actorHand: ["warder"] }), drawPileCount: 5 });
  const targetNoHand = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "sentinel", actorHandAfterPlay: ["warder"], targetId: "p2", guessedRank: 4, players: players({ actorHand: ["warder"], targetHand: [] }), drawPileCount: 5 });
  const noGuess = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "sentinel", actorHandAfterPlay: ["warder"], targetId: "p2", players: players({ actorHand: ["warder"], targetHand: ["warder"] }), drawPileCount: 5 });
  assert.deepEqual(hit.eliminatedPlayerIds, ["p2"]);
  assert.deepEqual(miss.eliminatedPlayerIds, []);
  assert.equal(noTarget.effectActivated, false);
  assert.equal(targetNoHand.effectActivated, false);
  assert.equal(noGuess.effectActivated, false);
});

test("Feint/Wager contract", () => {
  const hit = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "feint", actorHandAfterPlay: ["warder"], targetId: "p2", guessedRank: 4, players: players({ actorHand: ["warder"], targetHand: ["warder"] }), drawPileCount: 5 });
  const miss = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "wager", actorHandAfterPlay: ["warder"], targetId: "p2", guessedRank: 5, players: players({ actorHand: ["warder"], targetHand: ["warder"] }), drawPileCount: 5 });
  const targetNoHand = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "wager", actorHandAfterPlay: ["warder"], targetId: "p2", guessedRank: 5, players: players({ actorHand: ["warder"], targetHand: [] }), drawPileCount: 5 });
  assert.deepEqual(hit.eliminatedPlayerIds, []);
  assert.match(hit.logSuffix, /B.*公開/);
  assert.match(miss.logSuffix, /A は手札を公開/);
  assert.equal(targetNoHand.effectActivated, false);
});

test("Oracle contract", () => {
  const ok = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "oracle", actorHandAfterPlay: ["warder"], targetId: "p2", players: players({ actorHand: ["warder"], targetHand: ["legate"] }), drawPileCount: 5 });
  const noTarget = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "oracle", actorHandAfterPlay: ["warder"], players: players({ actorHand: ["warder"] }), drawPileCount: 5 });
  assert.equal(ok.instructions[0]?.type, "insert_action");
  assert.equal(noTarget.effectActivated, false);
});

test("Duelist contract", () => {
  const actorHigh = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "duelist", actorHandAfterPlay: ["arbiter"], targetId: "p2", players: players({ actorHand: ["arbiter"], targetHand: ["warder"] }), drawPileCount: 5 });
  const targetHigh = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "duelist", actorHandAfterPlay: ["warder"], targetId: "p2", players: players({ actorHand: ["warder"], targetHand: ["arbiter"] }), drawPileCount: 5 });
  const tie = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "duelist", actorHandAfterPlay: ["warder"], targetId: "p2", players: players({ actorHand: ["warder"], targetHand: ["warder"] }), drawPileCount: 5 });
  const noCards = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "duelist", actorHandAfterPlay: [], targetId: "p2", players: players({ actorHand: [], targetHand: [] }), drawPileCount: 5 });
  assert.deepEqual(actorHigh.eliminatedPlayerIds, ["p2"]);
  assert.deepEqual(targetHigh.eliminatedPlayerIds, ["p1"]);
  assert.deepEqual(tie.eliminatedPlayerIds, []);
  assert.equal(noCards.ok, true);
});

test("Warder/Legate/Arbiter/Vizier/Marquise/Emissary contract", () => {
  const warder = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "warder", actorHandAfterPlay: ["oracle"], players: players({ actorHand: ["oracle"] }), drawPileCount: 5 });
  const legate = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "legate", actorHandAfterPlay: ["oracle"], targetId: "p2", players: players({ actorHand: ["oracle"], targetHand: ["warder"] }), drawPileCount: 5 });
  const legateNoTarget = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "legate", actorHandAfterPlay: ["oracle"], players: players({ actorHand: ["oracle"] }), drawPileCount: 5 });
  const arbiter = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "arbiter", actorHandAfterPlay: ["oracle"], targetId: "p2", players: players({ actorHand: ["oracle"], targetHand: ["warder"] }), drawPileCount: 5 });
  const arbiterNoTarget = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "arbiter", actorHandAfterPlay: ["oracle"], players: players({ actorHand: ["oracle"] }), drawPileCount: 5 });
  const vizier = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "vizier", actorHandAfterPlay: ["oracle"], players: players({ actorHand: ["oracle"] }), drawPileCount: 5 });
  const marquise = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "marquise", actorHandAfterPlay: ["oracle"], players: players({ actorHand: ["oracle"] }), drawPileCount: 5 });
  const emissary = resolveCardEffect({ actorId: "p1", actorNickname: "A", cardId: "emissary", actorHandAfterPlay: [], players: players({ actorHand: [] }), drawPileCount: 5 });
  assert.deepEqual(warder.instructions[0], { type: "set_shield", playerId: "p1" });
  assert.equal(legate.instructions.some((i) => i.type === "force_discard"), true);
  assert.equal(legate.instructions.some((i) => i.type === "insert_action" && i.actionType === "force_discard"), true);
  assert.equal(legateNoTarget.effectActivated, false);
  assert.equal(arbiter.instructions[0]?.type, "swap_hands");
  assert.equal(arbiterNoTarget.effectActivated, false);
  assert.equal(vizier.effectActivated, true);
  assert.equal(marquise.effectActivated, true);
  assert.deepEqual(emissary.eliminatedPlayerIds, ["p1"]);
});
