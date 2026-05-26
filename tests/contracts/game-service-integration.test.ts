import type { CardId } from "@/lib/game/types";
import test from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { actions, hands, logs } from "@/drizzle/schema";
import { createRoomWithBot, fetchGameState, handleGameAction } from "@/lib/server/game-service";

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const describeIfDb = hasTestDb ? test.describe : test.describe.skip;

describeIfDb("game-service integration (DB)", () => {
  async function getMutationCounts(gameId: string, playerId: string) {
    const [actionRows, logRows, handRows] = await Promise.all([
      db.select().from(actions).where(eq(actions.gameId, gameId)),
      db.select().from(logs).where(eq(logs.gameId, gameId)),
      db.select().from(hands).where(and(eq(hands.gameId, gameId), eq(hands.playerId, playerId))),
    ]);
    return {
      actionCount: actionRows.length,
      logCount: logRows.length,
      handCards: (handRows[0]?.cards ?? []) as CardId[],
    };
  }

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

  test("play_card auth contract: valid room/game/player succeeds", async () => {
    const room = await createRoomWithBot(`T_${Date.now()}`);
    const before = (await fetchGameState(room.roomId, room.playerId)).state!;
    const targetId = before.players.find((p) => p.id !== room.playerId && !p.isEliminated)?.id;
    assert.ok(targetId);

    const result = await handleGameAction({
      roomId: room.roomId,
      gameId: before.id,
      playerId: room.playerId,
      type: "play_card",
      payload: { cardId: "oracle", targetId },
    });
    assert.equal(result.success, true);
  });

  test("play_card auth contract: mixed gameId from another room is rejected with no mutation", async () => {
    const roomA = await createRoomWithBot(`A_${Date.now()}`);
    const roomB = await createRoomWithBot(`B_${Date.now()}`);
    const stateA = (await fetchGameState(roomA.roomId, roomA.playerId)).state!;
    const stateB = (await fetchGameState(roomB.roomId, roomB.playerId)).state!;
    const before = await getMutationCounts(stateB.id, roomB.playerId);

    const result = await handleGameAction({
      roomId: roomB.roomId,
      gameId: stateA.id,
      playerId: roomB.playerId,
      type: "play_card",
      payload: { cardId: "oracle", targetId: stateB.players.find((p) => p.id !== roomB.playerId && !p.isEliminated)?.id },
    });
    assert.equal(result.success, false);

    const after = await getMutationCounts(stateB.id, roomB.playerId);
    assert.deepEqual(after, before);
  });

  test("play_card auth contract: other room playerId is rejected with no mutation", async () => {
    const roomA = await createRoomWithBot(`A_${Date.now()}`);
    const roomB = await createRoomWithBot(`B_${Date.now()}`);
    const stateA = (await fetchGameState(roomA.roomId, roomA.playerId)).state!;
    const stateB = (await fetchGameState(roomB.roomId, roomB.playerId)).state!;
    const before = await getMutationCounts(stateB.id, roomB.playerId);

    const result = await handleGameAction({
      roomId: roomB.roomId,
      gameId: stateB.id,
      playerId: roomA.playerId,
      type: "play_card",
      payload: { cardId: "oracle", targetId: stateB.players.find((p) => p.id !== roomB.playerId && !p.isEliminated)?.id },
    });
    assert.equal(result.success, false);

    const after = await getMutationCounts(stateB.id, roomB.playerId);
    assert.deepEqual(after, before);
  });

  test("play_card auth contract: same-room non-active playerId is rejected with no mutation", async () => {
    const room = await createRoomWithBot(`T_${Date.now()}`);
    const state = (await fetchGameState(room.roomId, room.playerId)).state!;
    const nonActivePlayerId = state.players.find((p) => p.id !== state.activePlayerId && !p.isEliminated)?.id;
    assert.ok(nonActivePlayerId);
    const before = await getMutationCounts(state.id, state.activePlayerId);

    const result = await handleGameAction({
      roomId: room.roomId,
      gameId: state.id,
      playerId: nonActivePlayerId!,
      type: "play_card",
      payload: { cardId: "oracle", targetId: state.players.find((p) => p.id === state.activePlayerId)?.id },
    });
    assert.equal(result.success, false);

    const after = await getMutationCounts(state.id, state.activePlayerId);
    assert.deepEqual(after, before);
  });

  test("play_card auth contract: non-existing gameId is rejected", async () => {
    const room = await createRoomWithBot(`T_${Date.now()}`);
    const state = (await fetchGameState(room.roomId, room.playerId)).state!;

    const result = await handleGameAction({
      roomId: room.roomId,
      gameId: "00000000-0000-4000-8000-000000000000",
      playerId: room.playerId,
      type: "play_card",
      payload: { cardId: "oracle", targetId: state.players.find((p) => p.id !== room.playerId && !p.isEliminated)?.id },
    });
    assert.equal(result.success, false);
  });
});
