import test from "node:test";
import assert from "node:assert/strict";

import { actionSchema } from "@/app/api/game/action/schema";

const uuid = "11111111-1111-4111-8111-111111111111";

test("api schema: missing cardId for play_card is allowed at schema level", () => {
  const parsed = actionSchema.safeParse({ gameId: uuid, roomId: uuid, playerId: uuid, type: "play_card", payload: {} });
  assert.equal(parsed.success, true);
});

test("api schema: invalid uuid is rejected", () => {
  const parsed = actionSchema.safeParse({ gameId: "bad", roomId: uuid, playerId: uuid, type: "play_card", payload: { cardId: "oracle" } });
  assert.equal(parsed.success, false);
});

test("api schema: guessedRank range", () => {
  assert.equal(actionSchema.safeParse({ gameId: uuid, roomId: uuid, playerId: uuid, type: "play_card", payload: { cardId: "sentinel", guessedRank: 0 } }).success, false);
  assert.equal(actionSchema.safeParse({ gameId: uuid, roomId: uuid, playerId: uuid, type: "play_card", payload: { cardId: "sentinel", guessedRank: 9 } }).success, false);
});

test("api schema: invalid action type rejected", () => {
  const parsed = actionSchema.safeParse({ gameId: uuid, roomId: uuid, playerId: uuid, type: "hack", payload: {} });
  assert.equal(parsed.success, false);
});
