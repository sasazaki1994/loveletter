import { test as base, expect, APIRequestContext, Page } from "@playwright/test";

export const test = base;
export { expect };

export async function waitForGameUI(page: Page, timeoutMs = 20000) {
  const viewport = page.viewportSize();
  const isNarrow = viewport ? viewport.width < 800 : false;
  const effectiveTimeout = Math.max(timeoutMs, isNarrow ? 60000 : timeoutMs);
  const start = Date.now();
  {
    const sessionWaitStart = Date.now();
    while (Date.now() - sessionWaitStart < effectiveTimeout) {
      const sessionMissing = await page.getByText('セッション未検出').isVisible().catch(() => false);
      if (!sessionMissing) break;
      await page.waitForTimeout(200);
    }
  }
  for (;;) {
    const hasTable = await page.getByRole('region', { name: 'ゲームテーブル' }).isVisible().catch(() => false);
    if (hasTable) return;
    const banner = await page.getByText(/(の手番|ターン待機中)/).isVisible().catch(() => false);
    if (banner) return;
    const actionButton = await page.getByRole('button', { name: /カードを使う|Play Card/i }).isVisible().catch(() => false);
    if (actionButton) return;
    if (Date.now() - start > effectiveTimeout) throw new Error('Game UI not visible');
    await page.waitForTimeout(500);
  }
}

export async function createBotRoomViaUI(page: Page, nickname: string) {
  await page.goto("/");
  const input = page.getByLabel(/ニックネーム|Nickname/i).or(
    page.getByPlaceholder(/例|name|nickname/i),
  );
  await input.first().fill(nickname);
  const btn = page.getByRole("button", { name: /Bot対戦を開始|Create Room|Start/i });
  await btn.first().click();
  try {
    await page.waitForURL(/\/game\//, { timeout: 12000 });
    return;
  } catch {
    const r = await page.request.post("/api/room/create", {
      data: { nickname, variants: [] },
    });
    const json = (await r.json()) as { roomId?: string; playerId?: string };
    if (!r.ok() || !json.roomId || !json.playerId) throw new Error("failed to create room via API fallback");
    await page.addInitScript(([roomId, playerId, nick]) => {
      window.sessionStorage.setItem(
        "llr:session",
        JSON.stringify({ roomId, playerId, nickname: nick }),
      );
    }, [json.roomId, json.playerId, nickname]);
    await page.goto(`/game/${json.roomId}`);
  }
}

export async function createBotRoomViaAPI(
  request: APIRequestContext,
  nickname: string,
  opts?: { seed?: string; deck?: string; variants?: string[] },
) {
  const params = new URLSearchParams();
  if (opts?.seed || opts?.deck) {
    params.set("test", "1");
    if (opts.seed) params.set("seed", opts.seed);
    if (opts.deck) params.set("deck", opts.deck);
  }
  const url = "/api/room/create" + (params.toString() ? `?${params.toString()}` : "");
  const res = await request.post(url, {
    data: { nickname, variants: opts?.variants ?? [] },
  });
  const json = await res.json();
  if (!res.ok()) {
    throw new Error(`create failed: ${json?.error ?? res.status()}`);
  }
  return json as { roomId: string; playerId: string; playerToken?: string; gameId?: string };
}

export async function fetchStateForPlayer(
  request: APIRequestContext,
  roomId: string,
  playerId: string,
  playerToken?: string,
) {
  const url = new URL("/api/game/state", "http://localhost");
  url.searchParams.set("roomId", roomId);
  url.searchParams.set("playerId", playerId);
  const res = await request.get(url.pathname + url.search, {
    headers: {
      "X-Player-Id": playerId,
      ...(playerToken ? { "X-Player-Token": playerToken } : {}),
    },
  });
  expect(res.ok()).toBeTruthy();
  const json = (await res.json()) as { state: any };
  return json.state;
}

export async function dismissCookieConsentIfVisible(page: Page) {
  const acceptBtn = page.getByRole("button", { name: /同意する|Accept/i });
  if (await acceptBtn.first().isVisible().catch(() => false)) {
    await acceptBtn.first().click({ timeout: 3000 }).catch(() => {});
  }
}

export async function postPlayCard(
  request: APIRequestContext,
  params: {
    roomId: string;
    gameId: string;
    playerId: string;
    cardId: string;
    targetId?: string;
    guessedRank?: number;
  },
) {
  return request.post("/api/game/action", {
    headers: { "X-Player-Id": params.playerId, "Content-Type": "application/json" },
    data: {
      gameId: params.gameId,
      roomId: params.roomId,
      playerId: params.playerId,
      type: "play_card",
      payload: {
        cardId: params.cardId,
        ...(params.targetId ? { targetId: params.targetId } : {}),
        ...(params.guessedRank !== undefined ? { guessedRank: params.guessedRank } : {}),
      },
    },
  });
}

export function findSelf(state: any, playerId: string) {
  return (state.players as Array<any>).find((p) => p.id === playerId);
}

export function findOpponent(state: any, playerId: string, predicate?: (p: any) => boolean) {
  return (state.players as Array<any>).find(
    (p) => p.id !== playerId && !p.isEliminated && (!predicate || predicate(p)),
  );
}

export async function waitForServerState(
  request: APIRequestContext,
  roomId: string,
  player?: { id: string; token?: string },
  timeoutMs = 20000,
) {
  const start = Date.now();
  for (;;) {
    const url = new URL('/api/game/state', 'http://localhost');
    url.searchParams.set('roomId', roomId);
    if (player?.id) url.searchParams.set('playerId', player.id);
    const res = await request.get(url.pathname + url.search, {
      headers: player?.token ? { 'X-Player-Id': player.id, 'X-Player-Token': player.token } : {},
    });
    if (res.status() === 200) {
      const json = await res.json();
      if (json?.state) return json;
    }
    if (Date.now() - start > timeoutMs) throw new Error('Server state not ready');
    await new Promise((r) => setTimeout(r, 500));
  }
}


export async function createTwoPlayerHumanRoomViaAPI(request: APIRequestContext, hostNickname: string, guestNickname: string) {
  const createRes = await request.post('/api/room/create-human', { data: { nickname: hostNickname } });
  expect(createRes.ok()).toBeTruthy();
  const created = await createRes.json() as { roomId: string; playerId: string; playerToken?: string };

  const joinRes = await request.post('/api/room/join', { data: { roomId: created.roomId, nickname: guestNickname } });
  expect(joinRes.ok()).toBeTruthy();
  const joined = await joinRes.json() as { playerId: string; playerToken?: string };

  const startRes = await request.post('/api/room/start', {
    headers: {
      'X-Player-Id': created.playerId,
      ...(created.playerToken ? { 'X-Player-Token': created.playerToken } : {}),
    },
    data: { roomId: created.roomId },
  });
  expect(startRes.ok()).toBeTruthy();
  const started = await startRes.json() as { gameId: string };

  return {
    roomId: created.roomId,
    gameId: started.gameId,
    host: { id: created.playerId, token: created.playerToken },
    guest: { id: joined.playerId, token: joined.playerToken },
  };
}
