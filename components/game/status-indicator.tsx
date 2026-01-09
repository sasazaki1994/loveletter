'use client';

import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGameContext } from "./game-provider";
import { useEffect, useState } from "react";

export function StatusIndicator() {
  const { error, loading, lastUpdated } = useGameContext();
  const [show, setShow] = useState(false);
  const [isDelayedLoading, setIsDelayedLoading] = useState(false);

  // 一瞬のローディングでチカチカしないように遅延させる
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading) {
      timer = setTimeout(() => setIsDelayedLoading(true), 1000);
    } else {
      setIsDelayedLoading(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (error || isDelayedLoading) {
      setShow(true);
    } else {
      const timer = setTimeout(() => setShow(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [error, isDelayedLoading, lastUpdated]);

  // 正常時は表示しない（隠す）
  if (!show && !error && !isDelayedLoading) return null;

  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-md transition-all duration-300",
      error 
        ? "bg-red-500/90 text-white border border-red-400" 
        : isDelayedLoading
          ? "bg-[rgba(12,32,30,0.8)] text-[var(--color-accent-light)] border border-[rgba(215,178,110,0.3)]"
          : "bg-[rgba(12,32,30,0.6)] text-[var(--color-text-muted)] border border-[rgba(255,255,255,0.1)] opacity-0"
    )}>
      {error ? (
        <>
          <WifiOff className="h-3 w-3 animate-pulse" />
          <span>{error}</span>
        </>
      ) : isDelayedLoading ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>通信中...</span>
        </>
      ) : (
        <>
          <Wifi className="h-3 w-3" />
          <span>接続完了</span>
        </>
      )}
    </div>
  );
}
