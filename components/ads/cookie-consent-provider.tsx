"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import Script from "next/script";
import Link from "next/link";

type ConsentState = "pending" | "accepted" | "rejected";

const STORAGE_KEY = "llr:cookie-consent";

const CookieConsentContext = createContext<{
  consent: ConsentState;
  accept: () => void;
  reject: () => void;
  reset: () => void;
}>({
  consent: "pending",
  accept: () => {},
  reject: () => {},
  reset: () => {},
});

export function useCookieConsent() {
  return useContext(CookieConsentContext);
}

function CookieConsentBanner() {
  const { accept, reject } = useCookieConsent();
  const bannerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;

    const firstButton = bannerRef.current?.querySelector<HTMLButtonElement>("button");
    firstButton?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusable = bannerRef.current?.querySelectorAll<HTMLElement>(
        'button, a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  return (
    <div
      ref={bannerRef}
      role="dialog"
      aria-label="Cookie の使用について"
      aria-describedby="cookie-consent-description"
      className="fixed inset-x-0 bottom-0 z-[9999] animate-fade-in"
    >
      <div className="mx-auto max-w-3xl px-4 pb-4">
        <div className="rounded-2xl border border-[rgba(215,178,110,0.35)] bg-[rgba(12,28,26,0.97)] p-5 shadow-[0_-8px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <p
            id="cookie-consent-description"
            className="text-sm leading-relaxed text-[var(--color-text-muted)]"
          >
            当サイトでは、サービス改善および広告配信のために Cookie
            を使用しています。「同意する」を選択すると、広告配信用の Cookie
            （Google AdSense 等）の使用に同意したものとみなします。詳細は
            <Link
              href="/privacy"
              className="mx-1 underline underline-offset-2"
            >
              プライバシーポリシー
            </Link>
            をご確認ください。
          </p>
          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              onClick={reject}
              className="rounded-lg border border-[rgba(255,255,255,0.12)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[rgba(255,255,255,0.06)]"
            >
              必須のみ
            </button>
            <button
              onClick={accept}
              className="rounded-lg border-0 bg-[var(--color-accent)] px-5 py-2 text-sm font-bold text-[var(--color-surface)] shadow-[0_0_16px_rgba(215,178,110,0.35)] transition-all hover:brightness-110"
            >
              同意する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<ConsentState>("pending");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "accepted" || stored === "rejected") {
        setConsent(stored);
      }
    } catch {
      // localStorage unavailable (e.g., private browsing mode)
    }
    setMounted(true);
  }, []);

  const accept = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "accepted");
    } catch {
      // localStorage unavailable
    }
    setConsent("accepted");
  }, []);

  const reject = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "rejected");
    } catch {
      // localStorage unavailable
    }
    setConsent("rejected");
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // localStorage unavailable
    }
    setConsent("pending");
  }, []);

  const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

  return (
    <CookieConsentContext.Provider value={{ consent, accept, reject, reset }}>
      {children}
      {consent === "accepted" && adsenseClient && (
        <Script
          id="adsbygoogle-init"
          strategy="afterInteractive"
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
          crossOrigin="anonymous"
        />
      )}
      {mounted && consent === "pending" && <CookieConsentBanner />}
    </CookieConsentContext.Provider>
  );
}
