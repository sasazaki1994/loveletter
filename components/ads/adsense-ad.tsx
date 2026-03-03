"use client";

import { useEffect, useRef } from "react";
import { useCookieConsent } from "./cookie-consent-provider";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export type AdsenseAdProps = {
  slot: string;
  className?: string;
  style?: React.CSSProperties;
  format?: "auto" | "rectangle" | "horizontal" | "vertical";
  fullWidthResponsive?: boolean;
};

export function AdsenseAd({
  slot,
  className,
  style,
  format = "auto",
  fullWidthResponsive = true,
}: AdsenseAdProps) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const { consent } = useCookieConsent();
  const filledRef = useRef(false);

  useEffect(() => {
    filledRef.current = false;
  }, [client, slot, consent]);

  useEffect(() => {
    if (!client || !slot || consent !== "accepted" || filledRef.current) return;
    const timer = setTimeout(() => {
      try {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
        filledRef.current = true;
      } catch {
        // Ad blockers / network failures should not crash the app.
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [client, slot, consent]);

  if (!client || !slot || consent !== "accepted") return null;

  return (
    <ins
      className={`adsbygoogle${className ? ` ${className}` : ""}`}
      style={{ display: "block", ...style }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={fullWidthResponsive ? "true" : "false"}
    />
  );
}
