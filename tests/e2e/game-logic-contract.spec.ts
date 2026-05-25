import {
  test,
  expect,
  createBotRoomViaAPI,
  fetchStateForPlayer,
  findOpponent,
  findSelf,
  postPlayCard,
  createTwoPlayerHumanRoomViaAPI,
} from "./fixtures";

type PublicPlayer = { id: string; isEliminated: boolean; nickname: string };
type PublicState = {
  id: string;
  hand?: string[];
  players: PublicPlayer[];
  discardPile?: string[];
  revealedSetupCards?: string[];
};

test.describe("Game logic API contract", () => {
  test("forced違反時に /api/game/action が 400 を返す (Marquise)", async ({ request }) => {
    // deck順: [burn, P1初期, P2初期, P3初期, P4初期, P1ドロー]
    // 意図: P1手札を marquise + legate にし、legate 使用を強制違反にする
    const deck = "oracle,marquise,sentinel,sentinel,sentinel,legate";
    const created = await createBotRoomViaAPI(request, `Forced_${Date.now()}`, { deck });

    const state = (await fetchStateForPlayer(request, created.roomId, created.playerId)) as PublicState;
    const target = findOpponent(state, created.playerId);
    expect(target).toBeTruthy();

    const res = await postPlayCard(request, {
      roomId: created.roomId,
      gameId: state.id,
      playerId: created.playerId,
      cardId: "legate",
      targetId: target!.id,
    });
    const json = await res.json();

    expect(res.status()).toBe(400);
    expect(json.success).toBe(false);
    expect(String(json.message)).toMatch(/Marquise|手札合計が12以上/);
  });

  test("Sentinel の推測命中で対象が脱落する", async ({ request }) => {
    // deck順: [burn, P1初期, P2初期, P3初期, P4初期, P1ドロー]
    // 意図: P1=sentinel保持、P2=emissary(ランク8)にして guessedRank=8 を命中させる
    const deck = "oracle,sentinel,emissary,warder,warder,legate";
    const created = await createBotRoomViaAPI(request, `Sentinel_${Date.now()}`, { deck });

    const before = (await fetchStateForPlayer(request, created.roomId, created.playerId)) as PublicState;
    const target = findOpponent(before, created.playerId);
    expect(target).toBeTruthy();

    const actionRes = await postPlayCard(request, {
      roomId: created.roomId,
      gameId: before.id,
      playerId: created.playerId,
      cardId: "sentinel",
      targetId: target!.id,
      guessedRank: 8,
    });
    const actionJson = await actionRes.json();
    expect(actionRes.ok()).toBeTruthy();
    expect(actionJson.success).toBe(true);

    const after = (await fetchStateForPlayer(request, created.roomId, created.playerId)) as PublicState;
    const targetAfter = after.players.find((p) => p.id === target!.id);
    expect(targetAfter?.isEliminated).toBe(true);
  });

  test("Duelist の比較で低ランク側が脱落する", async ({ request }) => {
    // deck順: [burn, P1初期, P2初期, P3初期, P4初期, P1ドロー]
    // 意図: P1=duelist+arbiter(6), P2=oracle(2) とし、比較で P2 を脱落させる
    const deck = "sentinel,duelist,oracle,warder,warder,arbiter";
    const created = await createBotRoomViaAPI(request, `Duelist_${Date.now()}`, { deck });

    const before = (await fetchStateForPlayer(request, created.roomId, created.playerId)) as PublicState;
    const target = findOpponent(before, created.playerId);
    expect(target).toBeTruthy();

    const actionRes = await postPlayCard(request, {
      roomId: created.roomId,
      gameId: before.id,
      playerId: created.playerId,
      cardId: "duelist",
      targetId: target!.id,
    });
    const actionJson = await actionRes.json();
    expect(actionRes.ok()).toBeTruthy();
    expect(actionJson.success).toBe(true);

    const after = (await fetchStateForPlayer(request, created.roomId, created.playerId)) as PublicState;
    const targetAfter = after.players.find((p) => p.id === target!.id);
    expect(targetAfter?.isEliminated).toBe(true);
  });

  test("Emissary を捨てると自分が脱落する", async ({ request }) => {
    // deck順: [burn, P1初期, P2初期, P3初期, P4初期, P1ドロー]
    // 意図: P1手札を emissary + sentinel にし emissary を捨てる
    const deck = "oracle,emissary,warder,warder,warder,sentinel";
    const created = await createBotRoomViaAPI(request, `Emissary_${Date.now()}`, { deck });

    const before = (await fetchStateForPlayer(request, created.roomId, created.playerId)) as PublicState;
    const actionRes = await postPlayCard(request, {
      roomId: created.roomId,
      gameId: before.id,
      playerId: created.playerId,
      cardId: "emissary",
    });
    const actionJson = await actionRes.json();
    expect(actionRes.ok()).toBeTruthy();
    expect(actionJson.success).toBe(true);

    const after = (await fetchStateForPlayer(request, created.roomId, created.playerId)) as PublicState;
    const selfAfter = findSelf(after, created.playerId);
    expect(selfAfter?.isEliminated).toBe(true);
  });

  test("disabled variant は /api/room/create variants に指定されても反映されない", async ({ request }) => {
    const created = await createBotRoomViaAPI(request, `Variants_${Date.now()}`, {
      variants: ["insight", "standoff", "ambush"],
    });

    const state = (await fetchStateForPlayer(request, created.roomId, created.playerId)) as PublicState;
    const visibleCards = [
      ...(state.hand ?? []),
      ...(state.discardPile ?? []),
      ...(state.revealedSetupCards ?? []),
    ];

    expect(visibleCards).not.toContain("insight");
    expect(visibleCards).not.toContain("standoff");
    expect(visibleCards).not.toContain("ambush");
  });
});

test("Legate force discard で対象手札が捨てられる", async ({ request }) => {
  const deck = "sentinel,legate,oracle,warder,warder,duelist,arbiter";
  const created = await createBotRoomViaAPI(request, `Legate_${Date.now()}`, { deck });
  const before = (await fetchStateForPlayer(request, created.roomId, created.playerId)) as PublicState;
  const target = findOpponent(before, created.playerId)!;
  const res = await postPlayCard(request, { roomId: created.roomId, gameId: before.id, playerId: created.playerId, cardId: 'legate', targetId: target.id });
  expect(res.ok()).toBeTruthy();
  const after = (await fetchStateForPlayer(request, created.roomId, created.playerId)) as PublicState;
  const targetState = after.players.find((p)=>p.id===target.id)!;
  expect(targetState.isEliminated).toBe(false);
  expect((after.discardPile ?? []).includes('oracle')).toBeTruthy();
});


test("Warder applies shield to self", async ({ request }) => {
  const deck = "oracle,warder,sentinel,sentinel,sentinel,duelist,oracle";
  const created = await createBotRoomViaAPI(request, `Warder_${Date.now()}`, { deck });
  const s1 = (await fetchStateForPlayer(request, created.roomId, created.playerId)) as PublicState;
  await postPlayCard(request, { roomId: created.roomId, gameId: s1.id, playerId: created.playerId, cardId: "warder" });
  const s2 = (await fetchStateForPlayer(request, created.roomId, created.playerId)) as PublicState;
  expect(findSelf(s2, created.playerId)?.shield).toBe(true);
});

test("Arbiter swaps hands", async ({ request }) => {
  const deck = "sentinel,arbiter,oracle,warder,warder,sentinel";
  const created = await createBotRoomViaAPI(request, `Arbiter_${Date.now()}`, { deck });
  const before = (await fetchStateForPlayer(request, created.roomId, created.playerId)) as PublicState;
  const target = findOpponent(before, created.playerId)!;
  const res = await postPlayCard(request, { roomId: created.roomId, gameId: before.id, playerId: created.playerId, cardId: "arbiter", targetId: target.id });
  expect(res.ok()).toBeTruthy();
  const after = (await fetchStateForPlayer(request, created.roomId, created.playerId)) as PublicState;
  expect(after.hand?.[0]).toBe("oracle");
});

test("Oracle peek is actor-only hint", async ({ request }) => {
  const deck = "sentinel,oracle,legate,warder,warder,duelist";
  const created = await createBotRoomViaAPI(request, `OraclePeek_${Date.now()}`, { deck });
  const s1 = (await fetchStateForPlayer(request, created.roomId, created.playerId)) as any;
  const target = findOpponent(s1, created.playerId)!;
  await postPlayCard(request, { roomId: created.roomId, gameId: s1.id, playerId: created.playerId, cardId: "oracle", targetId: target.id });
  const actor = await fetchStateForPlayer(request, created.roomId, created.playerId) as any;
  const targetState = await fetchStateForPlayer(request, created.roomId, target.id) as any;
  expect(actor.effectHints?.peek?.targetId).toBe(target.id);
  expect(targetState.effectHints?.peek).toBeUndefined();
});


test("Botが連続ターンで詰まらず進行する", async ({ request }) => {
  const deck = "oracle,sentinel,oracle,warder,warder,duelist,arbiter";
  const created = await createBotRoomViaAPI(request, `BotTurn_${Date.now()}`, { deck });

  const before = (await fetchStateForPlayer(request, created.roomId, created.playerId)) as any;
  const target = findOpponent(before, created.playerId)!;
  const turnIndexBefore = before.turnIndex;
  const botBefore = before.players.find((p: any) => p.isBot && p.id !== created.playerId);
  const botDiscardBefore = (botBefore?.discardPile ?? []).length;

  await postPlayCard(request, { roomId: created.roomId, gameId: before.id, playerId: created.playerId, cardId: 'sentinel', targetId: target.id, guessedRank: 2 });
  const mid = (await fetchStateForPlayer(request, created.roomId, created.playerId)) as any;
  expect(mid.activePlayerId).not.toBe(created.playerId);

  const botRes = await request.post('/api/game/bot-action', {
    headers: { 'X-Player-Id': created.playerId },
    data: { roomId: created.roomId, skipThinkDelay: true },
  });
  const botJson = await botRes.json();
  expect(botRes.status()).toBe(200);
  expect(botJson.success).toBe(true);

  const after = (await fetchStateForPlayer(request, created.roomId, created.playerId)) as any;
  const botAfter = after.players.find((p: any) => p.id === botBefore?.id);
  const botDiscardAfter = (botAfter?.discardPile ?? []).length;
  expect(botDiscardAfter).toBeGreaterThan(botDiscardBefore);
  expect(after.turnIndex).toBeGreaterThan(turnIndexBefore);
  expect(after.phase === 'choose_card' || after.phase === 'finished').toBeTruthy();
  expect(after.activePlayerId !== mid.activePlayerId || after.phase === 'finished').toBeTruthy();
});

test("2人戦 setup: burn非公開 + revealed 3枚", async ({ request }) => {
  const created = await createTwoPlayerHumanRoomViaAPI(request, `Host_${Date.now()}`, `Guest_${Date.now()}`);
  const hostState = (await fetchStateForPlayer(request, created.roomId, created.host.id)) as any;
  const guestState = (await fetchStateForPlayer(request, created.roomId, created.guest.id)) as any;

  expect(hostState.revealedSetupCards.length).toBe(3);
  expect(guestState.revealedSetupCards.length).toBe(3);
  expect(hostState.drawPileCount).toBe(8);

  const knownHostCards = [...(hostState.hand ?? []), ...(hostState.discardPile ?? []), ...(hostState.revealedSetupCards ?? [])];
  const knownGuestCards = [...(guestState.hand ?? []), ...(guestState.discardPile ?? []), ...(guestState.revealedSetupCards ?? [])];
  expect((hostState as Record<string, unknown>).burnCard).toBeUndefined();
  expect((guestState as Record<string, unknown>).burnCard).toBeUndefined();
  expect(knownHostCards.length).toBe(4);
  expect(knownGuestCards.length).toBe(4);
});
