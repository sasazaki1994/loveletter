import { expect } from "@playwright/test";
import { test, createBotRoomViaUI } from "./fixtures";

test.describe.configure({ mode: "serial" });

test("ロビーからBot対戦を開始できる", async ({ page }) => {
  const nickname = `E2E_${Math.floor(Math.random() * 10000)}`;
  await createBotRoomViaUI(page, nickname);

  // ゲームページに遷移
  await expect(page).toHaveURL(/\/game\//);

  // ターンバナーが表示され、フェーズラベルが出る
  await expect(page.getByText(/の手番|待機中/)).toBeVisible();
  await expect(page.getByText(/フェーズ:/)).toBeVisible();
});


