import { test, expect, createBotRoomViaUI } from "./fixtures";

test.describe.configure({ mode: "serial" });

test("リロード後も状態が継続しUIが復帰する", async ({ page }) => {
  await createBotRoomViaUI(page, "ReconnectE2E");
  await expect(page).toHaveURL(/\/game\//);

  // ターン/フェーズ表示が見える
  await expect(page.getByText(/フェーズ:/)).toBeVisible();

  // リロード
  await page.reload();

  // 復帰後も同様に見える
  await expect(page).toHaveURL(/\/game\//);
  await expect(page.getByText(/フェーズ:/)).toBeVisible();
});


