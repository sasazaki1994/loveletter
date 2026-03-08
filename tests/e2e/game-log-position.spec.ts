import { test, expect, createBotRoomViaUI, waitForGameUI } from "./fixtures";
import {
  OVERLAY_GAME_TABLE_MAX_WIDTH_REM,
  OVERLAY_INFO_RAIL_MAX_WIDTH_REM,
} from "@/components/game/layout-constants";

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

  const remInPx = 16;
  const overlayRailMaxWidthPx = OVERLAY_INFO_RAIL_MAX_WIDTH_REM * remInPx;
  const overlayTableMaxWidthPx = OVERLAY_GAME_TABLE_MAX_WIDTH_REM * remInPx;

  expect(logBox.x).toBeGreaterThan(viewport.width * 0.5);
  expect(logBox.y).toBeGreaterThan(viewport.height * 0.5);
  expect(logBox.x + logBox.width).toBeLessThanOrEqual(viewport.width);
  expect(logBox.y + logBox.height).toBeLessThanOrEqual(viewport.height);
  expect(logBox.height).toBeLessThan(220);

  const turnBanner = page.getByLabel("ターンバナー").first();
  await expect(turnBanner).toBeVisible();

  const bannerBox = await turnBanner.boundingBox();
  expect(bannerBox).not.toBeNull();

  if (!bannerBox) {
    throw new Error("turn banner bounding box unavailable");
  }

  expect(bannerBox.width).toBeLessThanOrEqual(overlayRailMaxWidthPx + 1);

  const tableRegion = page.getByRole("region", { name: "ゲームテーブル" }).first();
  await expect(tableRegion).toBeVisible();

  const tableBox = await tableRegion.boundingBox();
  expect(tableBox).not.toBeNull();

  if (!tableBox) {
    throw new Error("game table bounding box unavailable");
  }

  expect(tableBox.width).toBeGreaterThan(620);
  expect(tableBox.width).toBeLessThanOrEqual(overlayTableMaxWidthPx + 1);
});
