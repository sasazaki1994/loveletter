"use client";

import { useCookieConsent } from "./cookie-consent-provider";

export function CookieSettingsButton() {
  const { reset } = useCookieConsent();

  return (
    <button
      type="button"
      onClick={reset}
      className="underline underline-offset-2 hover:text-[var(--color-text)]"
    >
      Cookie 設定
    </button>
  );
}
