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
          "pointer-events-auto min-w-[18rem] rounded-3xl border border-[rgba(215,178,110,0.35)] bg-[rgba(17,40,36,0.92)] px-6 py-4 shadow-[0_24px_60px_rgba(0,0,0,0.45)] transition-all duration-300",
          isMyTurn && "border-[var(--color-accent)] shadow-[0_0_32px_rgba(215,178,110,0.25)]"
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs uppercase tracking-[0.6em] text-[rgba(215,178,110,0.7)]">
            Round {state?.round ?? 1} / 山札 {state?.drawPileCount ?? 0}
          </p>
          {state && (
            <span className="rounded-full border border-[rgba(215,178,110,0.2)] bg-[rgba(215,178,110,0.1)] px-2 py-0.5 text-[10px] text-[var(--color-accent-light)]">
              {PHASE_LABEL[state.phase]}
            </span>
          )}
        </div>
        <h2 className="mt-2 font-heading text-2xl text-[var(--color-accent-light)]">
          {activePlayer ? `${activePlayer.nickname} の手番` : "待機中"}
        </h2>
        <p className={cn("mt-1 text-sm", isMyTurn ? "text-[var(--color-accent-light)]" : "text-[var(--color-text-muted)]")}
        >
          {isMyTurn ? "カードを選び、アクションを実行してください" : "進行を待機しています"}
        </p>
      </div>
    </motion.aside>
  );
}

