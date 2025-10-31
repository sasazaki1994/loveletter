'use client';

import { useEffect, useRef } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useGameContext } from "@/components/game/game-provider";
import { CARD_DEFINITIONS } from "@/lib/game/cards";

const ICON_LABELS: Record<string, string> = {
  mask: "推測",
  eye: "洞察",
  swords: "決闘",
  shield: "守護",
  quill: "命令",
  balance: "交換",
  crown: "勝利",
  flame: "崩落",
  info: "情報",
  alert: "警告",
};

export function LogPanel() {
  const { state } = useGameContext();
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [state?.logs.length]);

  return (
    <aside
      className="pointer-events-auto w-full overflow-hidden rounded-xl border border-[rgba(215,178,110,0.2)] bg-[rgba(10,28,26,0.85)] shadow-[0_18px_46px_rgba(0,0,0,0.4)]"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      <div className="border-b border-[rgba(215,178,110,0.2)] px-4 py-3">
        <h3 className="font-heading text-lg text-[var(--color-accent-light)]">ラウンドログ</h3>
        <p className="text-xs text-[var(--color-text-muted)]">最新のアクションが時系列で表示されます。</p>
      </div>
      <ScrollArea className="h-64">
        <div ref={viewportRef} className="space-y-2 px-4 py-3 text-sm text-[var(--color-text-muted)]">
          {state?.logs.map((log) => {
            const label = log.icon ? ICON_LABELS[log.icon] ?? log.icon : "ログ";
            return (
              <div
                key={log.id}
                className="rounded-lg border border-[rgba(215,178,110,0.15)] bg-[rgba(12,32,30,0.7)] px-3 py-2"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-[rgba(215,178,110,0.6)]">{label}</p>
                <p className="mt-1 leading-relaxed text-[var(--color-text)]">{log.message}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            );
          })}
          {(!state?.logs || state.logs.length === 0) && (
            <p className="text-xs text-[var(--color-text-muted)]">まだログはありません。</p>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}

