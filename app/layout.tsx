import type { Metadata } from "next";
import Script from "next/script";
import { Crimson_Text, Work_Sans } from "next/font/google";

import "./globals.css";

const headingFont = Crimson_Text({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["400", "600", "700"],
  display: "swap",
});

const bodyFont = Work_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Love Letter Reverie",
  description: "ブラウザで遊べるラブレター系カードゲーム — リアルタイム対戦＆Bot対戦",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

  return (
    <html lang="ja" suppressHydrationWarning>
      <body
        className={`${headingFont.variable} ${bodyFont.variable} font-body antialiased text-[var(--color-text)]`}
      >
        <div className="min-h-screen bg-app-pattern text-[var(--color-text)]">
          {children}
        </div>
        {adsenseClient ? (
          <Script
            id="adsbygoogle-init"
            strategy="afterInteractive"
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
            crossOrigin="anonymous"
          />
        ) : null}
      </body>
    </html>
  );
}
