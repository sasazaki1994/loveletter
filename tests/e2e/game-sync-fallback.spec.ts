import { test, expect, createBotRoomViaAPI, waitForGameUI } from "./fixtures";

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

test.use({ viewport: { width: 1440, height: 1100 } });

test("SSEが使えなくてもpolling fallbackでゲーム進行が追従する", async ({ page, request, baseURL }) => {
  test.skip(test.info().project.name !== "chromium", "desktop chromium only");

  const created = await createBotRoomViaAPI(request, `Fallback_${Math.floor(Math.random() * 10000)}`);

  await page.route("**/api/game/stream?**", async (route) => {
    await route.abort("failed");
  });

  await page.addInitScript(([roomId, playerId, nickname]) => {
    window.sessionStorage.setItem(
      "llr:session",
      JSON.stringify({ roomId, playerId, nickname }),
    );
  }, [created.roomId, created.playerId, "FallbackHost"]);

  await page.goto(`${baseURL}/game/${created.roomId}`);
  await waitForGameUI(page, 45000);

  const logPanel = page.locator('[role="log"]').first();
  await expect(logPanel).toContainText("0件");

  await page.waitForTimeout(11000);

  const fetchState = async () => {
    const url = new URL("/api/game/state", "http://localhost");
    url.searchParams.set("roomId", created.roomId);
    url.searchParams.set("playerId", created.playerId);
    const res = await request.get(url.pathname + url.search);
    expect(res.ok()).toBeTruthy();
    return (await res.json()) as { state: any };
  };

  const sendAction = async (payload: Record<string, unknown>) => {
    const state = (await fetchState()).state;
    const res = await request.post("/api/game/action", {
      headers: {
        "X-Player-Id": created.playerId,
        "Content-Type": "application/json",
      },
      data: {
        gameId: state.id,
        roomId: created.roomId,
        playerId: created.playerId,
        type: "play_card",
        payload,
      },
    });
    return { ok: res.ok(), json: await res.json() };
  };

  const state = (await fetchState()).state;
  const hand: string[] = state.hand ?? state.self?.hand ?? [];
  const others = (state.players as Array<any>).filter((p) => !p.isEliminated && p.id !== created.playerId);
  const selfPlayer = (state.players as Array<any>).find((p) => p.id === created.playerId);
  const targetPool = [...others, selfPlayer].filter(Boolean);

  let played = false;
  for (let tryIdx = 0; tryIdx < Math.min(6, Math.max(1, hand.length) * 3); tryIdx += 1) {
    const cardId = hand[tryIdx % Math.max(1, hand.length)];
    const maybeTarget = targetPool.length ? targetPool[randInt(0, targetPool.length - 1)]?.id : undefined;
    const guessedRank = randInt(2, 8);
    const variants: Array<Record<string, unknown>> = [
      { cardId, targetId: maybeTarget, guessedRank },
      { cardId, targetId: maybeTarget },
      { cardId, guessedRank },
      { cardId },
    ];

    for (const payload of variants) {
      const res = await sendAction(payload);
      if (res.ok && res.json?.success) {
        played = true;
        break;
      }
    }
    if (played) break;
  }

  expect(played).toBeTruthy();
  await expect(logPanel).not.toContainText("0件", { timeout: 12000 });
});
