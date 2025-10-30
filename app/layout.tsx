import type { Metadata } from "next";
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
  description: "Steam風の質感を備えたラブレター系ブラウザゲーム MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body
        className={`${headingFont.variable} ${bodyFont.variable} font-body antialiased text-[var(--color-text)]`}
      >
        <div className="min-h-screen bg-app-pattern text-[var(--color-text)]">
          {children}
        </div>
      </body>
    </html>
  );
}
