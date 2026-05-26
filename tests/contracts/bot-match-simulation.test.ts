import test from "node:test";
import assert from "node:assert/strict";

import { chooseBotAction, getLegalBotTargets } from "@/lib/server/bot-service";
import { CARD_DEFINITIONS } from "@/lib/game/cards";
import type { CardId } from "@/lib/game/types";

const cards: CardId[] = ["sentinel", "oracle", "duelist", "warder", "legate", "arbiter", "vizier", "emissary", "feint", "wager", "marquise"];

test("bot simulation seeds 1..50 stay legal", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const hand: CardId[] = [cards[seed % cards.length], cards[(seed * 7) % cards.length]];
    const input = {
      selfId: "self",
      hand,
      players: [
        { id: "self", isEliminated: false, shield: false, handCount: 2, discardPile: [] as CardId[] },
        { id: "a", isEliminated: seed % 5 === 0, shield: seed % 3 === 0, handCount: seed % 2, discardPile: ["oracle"] as CardId[] },
        { id: "b", isEliminated: false, shield: false, handCount: 1, discardPile: ["duelist"] as CardId[] },
      ],
    };
    const action = chooseBotAction(input);
    assert.ok(hand.includes(action.cardId));
    const definition = CARD_DEFINITIONS[action.cardId];
    const legal = getLegalBotTargets(input, action.cardId).map((p) => p.id);
    const requiresTarget = definition.target !== "none" && legal.length > 0;
    if (requiresTarget) {
      assert.ok(action.targetId);
      assert.ok(legal.includes(action.targetId));
    }
    if (["sentinel", "feint", "wager"].includes(action.cardId)) {
      assert.equal(typeof action.guessedRank, "number");
      assert.notEqual(action.guessedRank, 1);
    }
  }
});
