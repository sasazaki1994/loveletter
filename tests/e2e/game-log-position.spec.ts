import { test, expect, createBotRoomViaUI, waitForGameUI } from "./fixtures";

test.use({ viewport: { width: 1440, height: 1100 } });

test("ゲームログがデスクトップで右下に固定表示される", async ({ page }) => {
  test.skip(test.info().project.name !== "chromium", "desktop chromium only");

  const nickname = `LogPos_${Math.floor(Math.random() * 10000)}`;
  await createBotRoomViaUI(page, nickname);
  await waitForGameUI(page, 45000);

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  const logPanel = page.locator('[role="log"]').first();
  await expect(logPanel).toBeVisible();

  const logBox = await logPanel.boundingBox();
  expect(logBox).not.toBeNull();

  if (!viewport || !logBox) {
    throw new Error("viewport or log panel bounding box unavailable");
  }

  expect(logBox.x).toBeGreaterThan(viewport.width * 0.5);
  expect(logBox.y).toBeGreaterThan(viewport.height * 0.5);
  expect(logBox.x + logBox.width).toBeLessThanOrEqual(viewport.width - 12);
  expect(logBox.y + logBox.height).toBeLessThanOrEqual(viewport.height - 12);
});
