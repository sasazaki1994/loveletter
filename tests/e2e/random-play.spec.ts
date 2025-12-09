import { test, expect } from "./fixtures";

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

test.describe.configure({ mode: "serial" });

test("ランダムプレイ: ボット戦を最後まで進行", async ({ request }) => {
  test.setTimeout(120_000);
  // 1) Bot戦の部屋をAPIで作成
  const createRes = await request.post("/api/room/create", {
    data: { nickname: "RandE2E", variants: [] },
  });
  expect(createRes.ok()).toBeTruthy();
  const created = await createRes.json();
  const roomId = created.roomId as string;
  const playerId = created.playerId as string;
  expect(roomId && playerId).toBeTruthy();

  // 2) サーバ状態の取得（self視点）
  async function fetchState() {
    const url = new URL("/api/game/state", "http://localhost");
    url.searchParams.set("roomId", roomId);
    url.searchParams.set("playerId", playerId);
    const res = await request.get(url.pathname + url.search);
    if (res.status() === 404) {
      // ゲーム終了やGC後などのケースを許容
      return { state: { result: { reason: "not_found" } } } as any;
    }
    expect(res.ok()).toBeTruthy();
    return (await res.json()) as { state: any };
  }

  async function sendAction(payload: any) {
    const s = await fetchState();
    const state = s.state;
    if (!state) return { ok: false, json: undefined };
    const res = await request.post("/api/game/action", {
      headers: {
        "X-Player-Id": playerId, // Bot部屋はトークン不要（レガシーモード）
        "Content-Type": "application/json",
      },
      data: {
        gameId: state.id,
        roomId,
        playerId,
        type: "play_card",
        payload,
      },
    });
    const json = await res.json();
    return { ok: res.ok(), json };
  }

  async function sendResign() {
    const s = await fetchState();
    const state = s.state;
    if (!state) return { ok: false, json: undefined };
    const res = await request.post("/api/game/action", {
      headers: {
        "X-Player-Id": playerId,
        "Content-Type": "application/json",
      },
      data: {
        gameId: state.id,
        roomId,
        playerId,
        type: "resign",
      },
    });
    const json = await res.json();
    return { ok: res.ok(), json };
  }

  // 3) 自分の手番を待って1手プレイ → Resignで終了
  // 手番待ち（最大10秒）
  {
    const start = Date.now();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const s = await fetchState();
      const st = s.state;
      if (st?.result) break;
      if (st?.activePlayerId === playerId) break;
      if (Date.now() - start > 10_000) break;
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  // 1手プレイを試みる（最大6トライ）
  {
    const s = await fetchState();
    const state = s.state;
    if (state && !state.result) {
      const hand: string[] = state.hand ?? state.self?.hand ?? [];
      const others = (state.players as Array<any>).filter((p) => !p.isEliminated && p.id !== playerId);
      const selfP = (state.players as Array<any>).find((p) => p.id === playerId);
      const targetPool = [...others, selfP].filter(Boolean);
      const handCandidates = [...hand];
      for (let tryIdx = 0; tryIdx < Math.min(6, Math.max(1, handCandidates.length) * 3); tryIdx += 1) {
        const cardId = handCandidates[tryIdx % Math.max(1, handCandidates.length)];
        const maybeTarget = targetPool.length ? targetPool[randInt(0, targetPool.length - 1)]?.id : undefined;
        const guessedRank = randInt(2, 8);
        const variants: Array<Record<string, any>> = [
          { cardId, targetId: maybeTarget, guessedRank },
          { cardId, targetId: maybeTarget },
          { cardId, guessedRank },
          { cardId },
        ];
        let ok = false;
        for (const payload of variants) {
          const res = await sendAction(payload);
          if (res.ok && res.json?.success) {
            ok = true;
            break;
          }
        }
        if (ok) break;
      }
    }
  }

  // Resignを送って確実に終了
  {
    // 自分の手番に揃えて送るのが安全
    const start = Date.now();
    let resignSent = false;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const s = await fetchState();
      const st = s.state;
      if (st?.result) break;
      if (st?.activePlayerId === playerId && !resignSent) {
        const res = await sendResign();
        if (res.ok && res.json?.success) {
          resignSent = true;
        }
      }
      if (Date.now() - start > 60_000) break;
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // 終了確認（404も許容、ボットの処理を待つ）
  {
    let done = false;
    const maxWaitTime = 90_000; // 90秒待つ（ボットの長考に備える）
    const start = Date.now();
    while (Date.now() - start < maxWaitTime) {
      const url = new URL("/api/game/state", "http://localhost");
      url.searchParams.set("roomId", roomId);
      url.searchParams.set("playerId", playerId);
      const res = await request.get(url.pathname + url.search);
      if (res.status() === 404) {
        // ゲーム終了やGC後などのケースを許容
        done = true;
        break;
      }
      if (res.ok()) {
        const json = await res.json();
        if (json?.state?.result) {
          done = true;
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    // 最終確認：resultが存在するか、404が返される
    const url = new URL("/api/game/state", "http://localhost");
    url.searchParams.set("roomId", roomId);
    url.searchParams.set("playerId", playerId);
    const finalRes = await request.get(url.pathname + url.search);
    if (finalRes.status() === 404) {
      // 404は許容（ゲーム終了してGCされた可能性がある）
      return;
    }
    expect(finalRes.ok()).toBeTruthy();
    const finalJson = await finalRes.json();
    const hasResult = finalJson?.state?.result;
    expect(hasResult).toBeTruthy();
  }
});


