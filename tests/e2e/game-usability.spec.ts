import { test, expect, createBotRoomViaUI, waitForGameUI } from "./fixtures";

test.use({ viewport: { width: 1365, height: 1000 } });

test("待機画面でゲーム目的と基本ルールが見える", async ({ page }) => {
  await page.goto("/");
  const input = page.getByLabel(/ニックネーム|Nickname/i).or(page.getByPlaceholder(/例|name|nickname/i));
  await input.first().fill(`Usability_${Date.now()}`);
  await page.getByRole("button", { name: /フレンドと遊ぶ|友達と遊ぶ|対人|Human|Room/i }).first().click();

  await page.waitForURL(/\/game\//, { timeout: 15000 });
  await expect(page.getByTestId("waiting-room-rule-panel")).toBeVisible();
  await expect(page.getByTestId("waiting-room-objective")).toBeVisible();
  await expect(page.getByTestId("waiting-room-basic-flow")).toBeVisible();
  await expect(page.getByTestId("waiting-room-win-condition")).toBeVisible();
});

test("プレイ中に次の操作ガイドが表示される", async ({ page }) => {
  await createBotRoomViaUI(page, `UsabilityBot_${Math.floor(Math.random() * 10000)}`);
  await waitForGameUI(page, 45000);

  await expect(page.getByTestId("action-next-step")).toBeVisible();
  await expect(page.getByTestId("action-next-step")).toContainText(/カードを1枚選択してください|進行を待ってください/);

  const handCards = page.locator('[data-testid="player-hand"] button');
  const handCount = await handCards.count();
  if (handCount > 0) {
    await handCards.first().click();
    await expect(page.getByTestId("action-selected-card")).not.toContainText("未選択");
    await expect(page.getByTestId("action-next-step")).toContainText(/対象プレイヤーを選択してください|推測するランクを 2〜8 で入力してください|カードを使用できます|対象がいないため/);
  }
});

test("結果画面で勝敗理由と次の行動が表示される", async ({ page, request }) => {
  const created = await request.post("/api/room/create", { data: { nickname: `Result_${Date.now()}`, variants: [] } });
  const createdJson = (await created.json()) as { roomId: string; playerId: string };

  await page.addInitScript(([roomId, playerId]) => {
    window.sessionStorage.setItem("llr:session", JSON.stringify({ roomId, playerId, nickname: "ResultUser" }));
  }, [createdJson.roomId, createdJson.playerId]);

  await page.goto(`/game/${createdJson.roomId}`);
  await waitForGameUI(page, 45000);

  // 早期終了のために降参を実行
  await page.getByRole("button", { name: /降参|resign/i }).first().click({ timeout: 10000 }).catch(() => {});

  await expect(page.getByTestId("game-result-panel")).toBeVisible({ timeout: 90000 });
  await expect(page.getByTestId("game-result-reason")).toBeVisible();
  await expect(page.getByTestId("game-result-next-action")).toBeVisible();
  await expect(page.getByTestId("game-retry-button")).toBeVisible();
});
