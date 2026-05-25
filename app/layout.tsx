import type { Metadata } from "next";

import { CookieConsentProvider } from "@/components/ads/cookie-consent-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Love Letter Reverie",
  description: "ブラウザで遊べるラブレター系カードゲーム — リアルタイム対戦＆Bot対戦",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="font-body antialiased text-[var(--color-text)]">
        <CookieConsentProvider>
          <div className="min-h-screen bg-app-pattern text-[var(--color-text)]">
            {children}
          </div>
        </CookieConsentProvider>
      </body>
    </html>
  );
}
