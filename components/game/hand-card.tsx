'use client';

import { motion } from "framer-motion";

import { CardSymbol } from "@/components/icons/card-symbol";
import { CARD_DEFINITIONS } from "@/lib/game/cards";
import type { CardId } from "@/lib/game/types";
import { cn } from "@/lib/utils";

interface HandCardProps {
  cardId: CardId;
  onSelect?: () => void;
  disabled?: boolean;
  selected?: boolean;
  ariaLabel?: string;
}

export function HandCard({ cardId, onSelect, disabled, selected, ariaLabel }: HandCardProps) {
  const definition = CARD_DEFINITIONS[cardId];
  if (!definition) return null;

  return (
    <motion.button
      type="button"
      className={cn(
        "relative h-[11rem] w-[7.6rem] origin-bottom rounded-[22px] border border-[rgba(215,178,110,0.45)] bg-gradient-to-br from-[rgba(28,68,63,0.92)] via-[rgba(22,52,47,0.95)] to-[rgba(14,32,29,0.98)] p-4 text-left shadow-[0_18px_50px_rgba(0,0,0,0.45)]",
        "transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
        selected && "scale-[1.05] -translate-y-3 shadow-[0_24px_60px_rgba(215,178,110,0.3)]",
        disabled && "opacity-60 grayscale",
      )}
      style={{ willChange: "transform" }}
      whileHover={disabled ? undefined : { scale: 1.05, rotate: 0.5 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={ariaLabel ?? `${definition.name} (${definition.rank})`}
    >
      <div className="flex items-center justify-between text-[var(--color-accent-light)]">
        <span className="font-heading text-3xl drop-shadow" aria-hidden>
          {definition.rank}
        </span>
        <span className="sr-only">ランク {definition.rank}</span>
        <span className="rounded-full border border-[rgba(215,178,110,0.6)] bg-[rgba(55,84,78,0.6)] px-2 py-0.5 text-xs uppercase tracking-[0.3em] text-[var(--color-accent-light)]">
          {definition.name.split(" ")[0]}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-center">
        <CardSymbol icon={definition.icon} size={38} className="text-[var(--color-accent-light)]" />
      </div>
      <p className="mt-4 max-h-20 overflow-hidden text-xs leading-relaxed text-[var(--color-text-muted)]">
        {definition.description}
      </p>
    </motion.button>
  );
}

