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
          "pointer-events-auto min-w-[20rem] rounded-3xl border border-[rgba(215,178,110,0.35)] bg-[rgba(17,40,36,0.92)] px-8 py-5 shadow-[0_24px_60px_rgba(0,0,0,0.55)] transition-all duration-300 backdrop-blur-md",
          isMyTurn && "border-[var(--color-accent)] shadow-[0_0_50px_rgba(215,178,110,0.4)] bg-gradient-to-r from-[rgba(17,40,36,0.95)] via-[rgba(45,35,20,0.9)] to-[rgba(17,40,36,0.95)] bg-[length:200%_100%] animate-[shimmer-bg_4s_linear_infinite]"
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
        <h2 className="mt-3 font-heading text-3xl text-[var(--color-accent-light)] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
          {activePlayer ? (
            <span className={cn("inline-block", isMyTurn && "animate-[pulse_2s_ease-in-out_infinite] text-shadow-gold")}>
              {activePlayer.nickname}
              <span className="ml-2 text-xl opacity-80 font-normal">の手番</span>
            </span>
          ) : "待機中"}
        </h2>
        <div className="mt-2 flex items-center gap-2">
           <div className={cn("h-px flex-1 transition-colors", isMyTurn ? "bg-[rgba(215,178,110,0.5)]" : "bg-[rgba(255,255,255,0.1)]")} />
           <p className={cn(
             "text-sm transition-colors duration-300 px-2",
             isMyTurn ? "text-[var(--color-accent-light)] font-medium text-shadow-gold" : "text-[var(--color-text-muted)] opacity-80"
           )}>
             {isMyTurn ? "カードを選び、アクションを実行" : "進行を待機しています"}
           </p>
           <div className={cn("h-px flex-1 transition-colors", isMyTurn ? "bg-[rgba(215,178,110,0.5)]" : "bg-[rgba(255,255,255,0.1)]")} />
        </div>
      </div>
    </motion.aside>
  );
}

