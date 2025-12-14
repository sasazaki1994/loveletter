import { test as base, expect, APIRequestContext, Page } from "@playwright/test";

export const test = base;
export { expect };

export async function waitForGameUI(page: Page, timeoutMs = 20000) {
  const viewport = page.viewportSize();
  const isNarrow = viewport ? viewport.width < 800 : false;
  const effectiveTimeout = Math.max(timeoutMs, isNarrow ? 60000 : timeoutMs);
  const start = Date.now();
  // まずセッション未検出メッセージが消えるまで待つ（リロード後のセッション復元を待つ）
  {
    const sessionWaitStart = Date.now();
    while (Date.now() - sessionWaitStart < effectiveTimeout) {
      const sessionMissing = await page.getByText('セッション未検出').isVisible().catch(() => false);
      if (!sessionMissing) break;
      await page.waitForTimeout(200);
    }
  }
  // ゲームUIが表示されるまで待つ
  for (;;) {
    const hasTable = await page.getByRole('region', { name: 'ゲームテーブル' }).isVisible().catch(() => false);
    if (hasTable) return;
    // 代替としてターンバナーの一部文言でも可
    const banner = await page.getByText(/(の手番|ターン待機中)/).isVisible().catch(() => false);
    if (banner) return;
    // さらに代替としてアクションバーの主要ボタンで判定
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
    // Fallback: APIで作成して直接遷移
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
  opts?: { seed?: string; deck?: string },
) {
  const params = new URLSearchParams();
  if (opts?.seed || opts?.deck) {
    params.set("test", "1");
    if (opts.seed) params.set("seed", opts.seed);
    if (opts.deck) params.set("deck", opts.deck);
  }
  const url = "/api/room/create" + (params.toString() ? `?${params.toString()}` : "");
  const res = await request.post(url, {
    data: { nickname, variants: [] },
  });
  const json = await res.json();
  if (!res.ok()) {
    throw new Error(`create failed: ${json?.error ?? res.status()}`);
  }
  return json as { roomId: string; playerId: string; gameId?: string };
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


