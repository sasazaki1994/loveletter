import type { CardId } from "@/lib/game/types";
import test from "node:test";
import assert from "node:assert/strict";

import { createRoomWithBot, fetchGameState, handleGameAction } from "@/lib/server/game-service";

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const describeIfDb = hasTestDb ? test.describe : test.describe.skip;

describeIfDb("game-service integration (DB)", () => {
  test("forced marquise violation is rejected", async () => {
    const room = await createRoomWithBot(`T_${Date.now()}`, [], {
      fixedDeck: ["oracle", "marquise", "sentinel", "sentinel", "sentinel", "legate"],
    });
    const stateRes = await fetchGameState(room.roomId, room.playerId);
    const state = stateRes.state!;
    const targetId = state.players.find((p) => p.id !== room.playerId && !p.isEliminated)?.id;
    assert.ok(targetId);

    const result = await handleGameAction({
      roomId: room.roomId,
      gameId: state.id,
      playerId: room.playerId,
      type: "play_card",
      payload: { cardId: "legate", targetId },
    });

    assert.equal(result.success, false);
    assert.match(result.message ?? "", /Marquise/);
  });

  test("sentinel hit eliminates target", async () => {
    const room = await createRoomWithBot(`T_${Date.now()}`, [], {
      fixedDeck: ["oracle", "sentinel", "emissary", "warder", "warder", "legate"],
    });
    const beforeRes = await fetchGameState(room.roomId, room.playerId);
    const before = beforeRes.state!;
    const targetId = before.players.find((p) => p.id !== room.playerId && !p.isEliminated)?.id;
    assert.ok(targetId);

    const result = await handleGameAction({
      roomId: room.roomId,
      gameId: before.id,
      playerId: room.playerId,
      type: "play_card",
      payload: { cardId: "sentinel", targetId, guessedRank: 8 },
    });
    assert.equal(result.success, true);

    const afterRes = await fetchGameState(room.roomId, room.playerId);
    const after = afterRes.state!;
    assert.equal(after.players.find((p) => p.id === targetId)?.isEliminated, true);
  });

  test("disabled variants are ignored in deck", async () => {
    const room = await createRoomWithBot(`T_${Date.now()}`, ["insight", "standoff", "ambush"] as CardId[]);
    const stateRes = await fetchGameState(room.roomId, room.playerId);
    const state = stateRes.state!;
    const visible = [...(state.hand ?? []), ...(state.revealedSetupCards ?? []), ...(state.discardPile ?? [])];
    assert.equal(visible.includes("insight" as never), false);
    assert.equal(visible.includes("standoff" as never), false);
    assert.equal(visible.includes("ambush" as never), false);
  });
});
