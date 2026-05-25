import { test, expect, createBotRoomViaAPI, fetchStateForPlayer, findOpponent, postPlayCard } from "./fixtures";

test("Bot連続ターンで人間手番へ戻るか終了する", async ({ request }) => {
  const created = await createBotRoomViaAPI(request, `BotChain_${Date.now()}`);
  const before = await fetchStateForPlayer(request, created.roomId, created.playerId) as any;
  const target = findOpponent(before, created.playerId)!;
  const handCard = before.hand?.[0] ?? "warder";
  const playRes = await postPlayCard(request, { roomId: created.roomId, gameId: before.id, playerId: created.playerId, cardId: handCard, targetId: target.id, guessedRank: 8 });
  expect(playRes.status()).not.toBe(500);

  for (let i = 0; i < 8; i++) {
    const s = await fetchStateForPlayer(request, created.roomId, created.playerId) as any;
    if (s.phase === "finished" || s.activePlayerId === created.playerId) break;
    const botRes = await request.post('/api/game/bot-action', { headers: { 'X-Player-Id': created.playerId }, data: { roomId: created.roomId, skipThinkDelay: true } });
    expect(botRes.status()).not.toBe(500);
  }

  const after = await fetchStateForPlayer(request, created.roomId, created.playerId) as any;
  expect(["choose_card", "finished"]).toContain(after.phase);
  expect(after.turnIndex).toBeGreaterThanOrEqual(before.turnIndex);
});

test("Bot戦1ラウンド完走", async ({ request }) => {
  const created = await createBotRoomViaAPI(request, `BotRound_${Date.now()}`);
  const MAX_ACTIONS = 60;

  for (let i = 0; i < MAX_ACTIONS; i++) {
    const s = await fetchStateForPlayer(request, created.roomId, created.playerId) as any;
    if (s.phase === "finished") {
      expect(s.result?.winnerIds?.length ?? 0).toBeGreaterThan(0);
      return;
    }
    if (s.activePlayerId === created.playerId && s.phase === "choose_card") {
      const cardId = s.hand?.[0];
      if (!cardId) continue;
      const target = findOpponent(s, created.playerId);
      await postPlayCard(request, { roomId: created.roomId, gameId: s.id, playerId: created.playerId, cardId, targetId: target?.id, guessedRank: 8 });
      continue;
    }
    await request.post('/api/game/bot-action', { headers: { 'X-Player-Id': created.playerId }, data: { roomId: created.roomId, skipThinkDelay: true } });
  }

  throw new Error("Bot match did not finish within MAX_ACTIONS");
});
