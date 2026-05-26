import { test, expect, dismissCookieConsentIfVisible } from "./fixtures";

test.describe("Invite paste flow", () => {
  test("招待URLを貼り付けてもRoom IDを自動抽出できる", async ({ page }) => {
    await page.goto("/");
    await dismissCookieConsentIfVisible(page);

    const joinInput = page.getByPlaceholder(/Room ID を入力|ルームID/i);
    await joinInput.fill("https://localhost:3100/?join=QR2345&mode=multi");
    await joinInput.blur();

    await expect(joinInput).toHaveValue("QR2345", { timeout: 5000 });
  });
});

