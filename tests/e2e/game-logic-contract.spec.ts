import {
  test,
  expect,
  createBotRoomViaAPI,
  fetchStateForPlayer,
  findOpponent,
  findSelf,
  postPlayCard,
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
