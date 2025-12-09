import { expect } from "@playwright/test";
import { test, createBotRoomViaUI, waitForGameUI } from "./fixtures";

test.describe.configure({ mode: "serial" });

test("ロビーからBot対戦を開始できる", async ({ page }) => {
  const nickname = `E2E_${Math.floor(Math.random() * 10000)}`;
  await createBotRoomViaUI(page, nickname);

  // ゲームページに遷移
  await expect(page).toHaveURL(/\/game\//);

  // ゲームテーブル領域の可視性で安定確認
  await waitForGameUI(page, 45000);
});


