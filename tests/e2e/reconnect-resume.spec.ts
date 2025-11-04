import { test, expect, createBotRoomViaUI, waitForGameUI, waitForServerState } from "./fixtures";

test.describe.configure({ mode: "serial" });

test("リロード後も状態が継続しUIが復帰する", async ({ page, request }) => {
  await createBotRoomViaUI(page, "ReconnectE2E");
  await expect(page).toHaveURL(/\/game\//);
  // サーバ状態がreadyか確認
  const url = new URL(page.url());
  const roomId = url.pathname.split('/').pop()!;
  await waitForServerState(request, roomId, undefined, 20000);

  // ゲームテーブルが見える
  await expect(page.getByRole('region', { name: 'ゲームテーブル' })).toBeVisible({ timeout: 15000 });

  // リロード
  await page.reload();

  // 復帰後も同様に見える
  await expect(page).toHaveURL(/\/game\//);
  await waitForServerState(request, roomId, undefined, 20000);
});


