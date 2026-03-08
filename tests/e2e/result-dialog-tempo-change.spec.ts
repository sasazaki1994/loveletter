import { test, expect, createBotRoomViaAPI, waitForGameUI } from "./fixtures";

test.use({ viewport: { width: 1440, height: 1100 } });

test("結果検出後にテンポが変わってもリザルトダイアログが通常経路で開く", async ({ page, request, baseURL }) => {
  test.skip(test.info().project.name !== "chromium", "desktop chromium only");

  const created = await createBotRoomViaAPI(request, `TempoShift_${Math.floor(Math.random() * 10000)}`);

  await page.addInitScript(([roomId, playerId, nickname]) => {
    window.sessionStorage.setItem(
      "llr:session",
      JSON.stringify({ roomId, playerId, nickname }),
    );
  }, [created.roomId, created.playerId, "TempoShiftHost"]);

  await page.goto(`${baseURL}/game/${created.roomId}`);
  await waitForGameUI(page, 45000);

  const helperPage = await page.context().newPage();
  await helperPage.goto(baseURL!);

  const fetchState = async () => {
    const url = new URL("/api/game/state", "http://localhost");
    url.searchParams.set("roomId", created.roomId);
    url.searchParams.set("playerId", created.playerId);
    const res = await request.get(url.pathname + url.search);
    expect(res.ok()).toBeTruthy();
    return (await res.json()) as { state: any };
  };

  const current = (await fetchState()).state;
  const resignRes = await request.post("/api/game/action", {
    headers: {
      "X-Player-Id": created.playerId,
      "Content-Type": "application/json",
    },
    data: {
      gameId: current.id,
      roomId: created.roomId,
      playerId: created.playerId,
      type: "resign",
    },
  });
  expect(resignRes.ok()).toBeTruthy();

  await helperPage.evaluate(() => {
    const sequence = ["fast", "normal", "fast"];
    sequence.forEach((tempo, index) => {
      window.setTimeout(() => {
        window.localStorage.setItem("llr:tempo", tempo);
      }, 150 + index * 220);
    });
  });

  await expect(page.getByText("ラウンド終了")).toBeVisible({ timeout: 5000 });

  await helperPage.close();
});
