import { expect } from "@playwright/test";
import { test, createBotRoomViaUI, waitForGameUI } from "./fixtures";

test.describe.configure({ mode: "serial" });

test("ゲーム画面に可読性改善UIが表示される", async ({ page }) => {
  const nickname = `UX_${Math.floor(Math.random() * 10000)}`;
  await createBotRoomViaUI(page, nickname);
  await waitForGameUI(page, 45000);

  await expect(page.getByTestId("game-header")).toBeVisible();
  await expect(page.getByTestId("game-status")).toBeVisible();
  await expect(page.getByTestId("game-score")).toBeVisible();
  await expect(page.getByTestId("game-rule-panel")).toBeVisible();
  await expect(page.getByTestId("game-action-feedback")).toBeVisible();
});
