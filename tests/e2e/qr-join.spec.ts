import { test, expect } from "./fixtures";

test.describe("QR join flow", () => {
  test("QRコード読み取りでRoom IDを自動入力できる", async ({ page }) => {
    await page.addInitScript(() => {
      class FakeBarcodeDetector {
        static async getSupportedFormats() {
          return ["qr_code"];
        }
        async detect() {
          return [{ rawValue: "https://localhost:3100/?join=QR2345&mode=multi" }];
        }
      }
      // @ts-ignore
      window.BarcodeDetector = FakeBarcodeDetector;
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = async () => new MediaStream();
      }
    });

    await page.goto("/");
    // マルチ用ニックネーム入力（同じプレースホルダが2つあるため末尾を使用）
    await page.getByPlaceholder("例: Velvet Strategist").last().fill("QR Tester");
    await page.getByRole("button", { name: "QR読取" }).click();
    await page.evaluate(() =>
      // @ts-ignore
      window.__llrTestTriggerQr?.("https://localhost:3100/?join=QR2345&mode=multi"),
    );

    const joinInput = page.getByPlaceholder("Room ID を入力");
    await expect(joinInput).toHaveValue("QR2345", { timeout: 5000 });
    await expect(page.getByRole("dialog", { name: "QRコードで入室" })).not.toBeVisible({ timeout: 5000 });
  });

  test("BarcodeDetector未対応ブラウザではエラー表示する", async ({ page }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      delete window.BarcodeDetector;
    });

    await page.goto("/");
    await page.getByRole("button", { name: "QR読取" }).click();
    await expect(
      page.getByText("このブラウザはQRコード読み取りに対応していません"),
    ).toBeVisible();
  });
});



