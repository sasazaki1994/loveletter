import { test as base, expect, APIRequestContext, Page } from "@playwright/test";

export const test = base;
export { expect };

export async function createBotRoomViaUI(page: Page, nickname: string) {
  await page.goto("/");
  const input = page.getByLabel(/ニックネーム|Nickname/i).or(
    page.getByPlaceholder(/例|name|nickname/i),
  );
  await input.first().fill(nickname);
  const btn = page.getByRole("button", { name: /Bot対戦を開始|Create Room|Start/i });
  await btn.first().click();
  try {
    await page.waitForURL(/\/game\//, { timeout: 8000 });
    return;
  } catch {
    // Fallback: APIで作成して直接遷移
    const r = await page.request.post("/api/room/create", {
      data: { nickname, variants: [] },
    });
    const json = (await r.json()) as { roomId?: string };
    if (!r.ok() || !json.roomId) throw new Error("failed to create room via API fallback");
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


