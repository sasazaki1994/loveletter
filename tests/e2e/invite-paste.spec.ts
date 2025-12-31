import { test, expect } from "./fixtures";

test.describe("Invite paste flow", () => {
  test("招待URLを貼り付けてもRoom IDを自動抽出できる", async ({ page }) => {
    await page.goto("/");

    const joinInput = page.getByPlaceholder("Room ID を入力");
    await joinInput.fill("https://localhost:3100/?join=QR2345&mode=multi");
    await joinInput.blur();

    await expect(joinInput).toHaveValue("QR2345", { timeout: 5000 });
  });
});


