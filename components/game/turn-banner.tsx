'use client';

import { motion } from "framer-motion";

import type { ClientGameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";

interface TurnBannerProps {
  state: ClientGameState | null;
  isMyTurn: boolean;
}

const PHASE_LABEL: Record<ClientGameState["phase"], string> = {
  waiting: "待機中",
  setup: "セットアップ",
  draw: "ドロー",
  choose_card: "カード選択",
  resolve_effect: "効果解決",
  await_response: "応答待ち",
  round_end: "ラウンド終了",
  finished: "ラウンド終了",
};

export function TurnBanner({ state, isMyTurn }: TurnBannerProps) {
  const activePlayer = state?.players.find((p) => p.id === state.activePlayerId);

  return (
    <motion.aside
      key={`${state?.activePlayerId ?? "none"}-${state?.phase ?? "unknown"}`}
      initial={{ y: -32, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -32, opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="pointer-events-none w-full"
      aria-live="polite"
    >
      <div
        className={cn(
          "pointer-events-auto min-w-[20rem] rounded-2xl border border-[rgba(215,178,110,0.3)] bg-[rgba(16,36,33,0.9)] px-6 py-4 shadow-[0_16px_42px_rgba(0,0,0,0.45)] backdrop-blur-md transition-colors duration-200",
          isMyTurn && "border-[rgba(215,178,110,0.6)] bg-[rgba(24,48,43,0.94)]"
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs uppercase tracking-[0.6em] text-[rgba(215,178,110,0.8)] font-medium">
            Round {state?.round ?? 1} / <span className="tracking-widest">Deck {state?.drawPileCount ?? 0}</span>
          </p>
          {state && (
            <span className={cn(
              "rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-bold shadow-sm transition-colors duration-500",
              isMyTurn 
                ? "bg-[rgba(215,178,110,0.25)] border-[rgba(215,178,110,0.6)] text-[var(--color-accent-light)]" 
                : "bg-[rgba(0,0,0,0.2)] border-[rgba(255,255,255,0.1)] text-[var(--color-text-muted)]"
            )}>
              {PHASE_LABEL[state.phase]}
            </span>
          )}
        </div>
        <h2 className="mt-2.5 font-heading text-2xl text-[var(--color-accent-light)] sm:text-[1.75rem]">
          {activePlayer ? (
            <span className={cn("inline-block", isMyTurn && "text-shadow-gold")}>
              {activePlayer.nickname}
              <span className="ml-2 text-lg font-normal opacity-80">の手番</span>
            </span>
          ) : "待機中"}
        </h2>
        <div className="mt-2.5 flex items-center gap-2">
          <div className={cn("h-px flex-1 transition-colors", isMyTurn ? "bg-[rgba(215,178,110,0.45)]" : "bg-[rgba(255,255,255,0.12)]")} />
          <p className={cn(
            "px-2 text-sm transition-colors duration-300",
            isMyTurn ? "font-medium text-[var(--color-accent-light)]" : "text-[var(--color-text-muted)] opacity-85"
          )}>
            {isMyTurn ? "カードを選択して実行" : "進行を待機中"}
          </p>
          <div className={cn("h-px flex-1 transition-colors", isMyTurn ? "bg-[rgba(215,178,110,0.45)]" : "bg-[rgba(255,255,255,0.12)]")} />
        </div>
      </div>
    </motion.aside>
  );
}

