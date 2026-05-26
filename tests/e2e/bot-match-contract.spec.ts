import { test, expect, createBotRoomViaAPI, fetchStateForPlayer, findOpponent, postPlayCard } from "./fixtures";

test("Bot連続ターンで人間手番へ戻るか終了する", async ({ request }) => {
  const created = await createBotRoomViaAPI(request, "BotChain_Deterministic", { seed: "bot-chain-seed-1" });
  const before = await fetchStateForPlayer(request, created.roomId, created.playerId) as any;
  const target = findOpponent(before, created.playerId)!;
  const handCard = before.hand?.[0] ?? "warder";
  const playRes = await postPlayCard(request, { roomId: created.roomId, gameId: before.id, playerId: created.playerId, cardId: handCard, targetId: target.id, guessedRank: 8 });
  expect(playRes.ok()).toBeTruthy();
  const playBody = await playRes.json();
  expect(playBody.success).toBe(true);

  for (let i = 0; i < 8; i++) {
    const s = await fetchStateForPlayer(request, created.roomId, created.playerId) as any;
    if (s.phase === "finished" || s.activePlayerId === created.playerId) break;
    const botRes = await request.post('/api/game/bot-action', { headers: { 'X-Player-Id': created.playerId }, data: { roomId: created.roomId, skipThinkDelay: true } });
    expect(botRes.ok()).toBeTruthy();
    const botBody = await botRes.json();
    expect(botBody.success).toBe(true);
  }

  const after = await fetchStateForPlayer(request, created.roomId, created.playerId) as any;
  expect(["choose_card", "finished"]).toContain(after.phase);
  expect(after.turnIndex).toBeGreaterThanOrEqual(before.turnIndex);
});

test("Bot戦1ラウンド完走", async ({ request }) => {
  const created = await createBotRoomViaAPI(request, "BotRound_Deterministic", { seed: "bot-round-seed-1" });
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
