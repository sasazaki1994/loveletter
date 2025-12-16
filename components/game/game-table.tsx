'use client';

import { motion } from "framer-motion";
import { useState } from "react";
import { Layers } from "lucide-react";

import { CardSymbol } from "@/components/icons/card-symbol";
import { CardArt } from "@/components/game/card-art";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CARD_DEFINITIONS, ORDERED_CARD_IDS } from "@/lib/game/cards";
import type { CardId } from "@/lib/game/types";
import { cn } from "@/lib/utils";

interface GameTableProps {
  drawPileCount: number;
  discardPile: CardId[];
  revealedSetupCards: CardId[];
}

export function GameTable({ drawPileCount, discardPile, revealedSetupCards }: GameTableProps) {
  const topDiscard = discardPile[discardPile.length - 1];
  const [open, setOpen] = useState(false);

  const cardDefinition = topDiscard ? CARD_DEFINITIONS[topDiscard] : undefined;
  const discardKey = cardDefinition ? `${cardDefinition.id}-${discardPile.length}` : "empty";

  const discardCounts = discardPile.reduce<Partial<Record<CardId, number>>>((acc, card) => {
    acc[card] = (acc[card] ?? 0) + 1;
    return acc;
  }, {});

  const discardSummary = ORDERED_CARD_IDS.filter((cardId) => discardCounts[cardId])
    .map((cardId) => ({
      definition: CARD_DEFINITIONS[cardId],
      count: discardCounts[cardId] ?? 0,
    }));

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div className="bg-table-felt relative h-full w-full rounded-full shadow-[0_80px_120px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-[7%] rounded-full border border-[rgba(215,178,110,0.2)]" />
        <div className="absolute inset-[14%] rounded-full border border-[rgba(215,178,110,0.2)]" />

        <div className="relative h-full w-full">
          <div className="absolute left-1/2 top-1/2 flex -translate-x-[120%] -translate-y-1/2 flex-col items-center gap-2">
            <span className="text-xs uppercase tracking-[0.4em] text-[var(--color-text-muted)]">Draw</span>
            <motion.div
              className="h-[9.6rem] w-[6.5rem] rounded-[18px] border border-[rgba(215,178,110,0.25)] bg-[rgba(10,24,22,0.9)] shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
              style={{ willChange: "transform" }}
              animate={{ rotate: [0, -2, 2, 0] }}
              transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
            />
            <p className="text-xs text-[var(--color-text-muted)]">残り {drawPileCount} 枚</p>
          </div>

          <div className="absolute left-1/2 top-1/2 flex -translate-y-1/2 translate-x-[20%] flex-col items-center gap-2">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <motion.button
                  key={discardKey}
                  type="button"
                  className={cn(
                    "relative h-[10.5rem] w-[7.4rem] rounded-[18px] border border-[rgba(215,178,110,0.45)] bg-gradient-to-br from-[rgba(32,68,63,0.92)] via-[rgba(24,54,50,0.95)] to-[rgba(16,36,33,0.98)] p-4 text-left shadow-[0_18px_40px_rgba(0,0,0,0.4)]",
                    !cardDefinition && "opacity-60",
                  )}
                  style={{ willChange: "transform" }}
                  initial={{ opacity: 0, y: 24, scale: 0.9, rotateX: -10 }}
                  animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                  whileHover={{ scale: 1.05, rotate: 0.7 }}
                >
                  {cardDefinition ? (
                    <div className="flex h-full flex-col justify-between">
                      <div className="absolute inset-0 overflow-hidden rounded-[18px]">
                        <CardArt cardId={cardDefinition.id} alt={`${cardDefinition.name} (${cardDefinition.rank})`} className="opacity-95" />
                        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0)_0%,rgba(0,0,0,0.4)_55%,rgba(0,0,0,0.72)_100%)]" />
                      </div>
                      <div className="relative z-10 flex items-center justify-between text-[var(--color-accent-light)]">
                        <span className="font-heading text-3xl">{cardDefinition.rank}</span>
                        <CardSymbol icon={cardDefinition.icon} size={28} />
                      </div>
                      <span className="relative z-10 font-heading text-base text-[var(--color-accent-light)]">
                        {cardDefinition.name}
                      </span>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--color-text-muted)] opacity-50">
                      <Layers className="h-8 w-8" />
                      <span className="text-xs font-medium tracking-wider">DISCARD</span>
                    </div>
                  )}
                </motion.button>
              </PopoverTrigger>
              <PopoverContent className="w-72" side="top" align="center">
                <h4 className="font-heading text-lg text-[var(--color-accent-light)]">捨て札履歴</h4>
                <ScrollArea className="mt-3 h-48">
                  <div className="space-y-2 pr-3 text-sm text-[var(--color-text-muted)]">
                    {discardSummary.length > 0 ? (
                      discardSummary.map(({ definition, count }) => (
                        <div
                          key={definition.id}
                          className="flex items-center justify-between rounded-lg border border-[rgba(215,178,110,0.2)] bg-[rgba(12,32,30,0.7)] px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-heading text-lg text-[var(--color-accent-light)]">
                              {definition.rank}
                            </span>
                            <span className="font-heading text-sm text-[var(--color-accent-light)]">
                              {definition.name}
                            </span>
                          </div>
                          <div className="flex items-baseline gap-2 text-[var(--color-text-muted)]">
                            <span className="font-heading text-base text-[var(--color-accent-light)]">
                              x{count}
                            </span>
                            <span className="text-[10px] uppercase tracking-[0.2em]">
                              {count}/{definition.copies}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-[var(--color-text-muted)]">公開された捨て札はありません。</p>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-[var(--color-text-muted)]">捨て札スタック</p>
          </div>

          {revealedSetupCards.length > 0 && (
            <div className="absolute bottom-[12%] left-1/2 flex -translate-x-1/2 gap-2">
              {revealedSetupCards.map((card, index) => {
                const def = CARD_DEFINITIONS[card];
                return (
                  <div
                    key={`${card}-${index}`}
                    className="flex items-center gap-2 rounded-full border border-[rgba(215,178,110,0.35)] bg-[rgba(12,32,30,0.75)] px-3 py-1 text-xs text-[var(--color-text-muted)]"
                  >
                    <span className="font-heading text-base text-[var(--color-accent-light)]">
                      {def.rank}
                    </span>
                    <span>{def.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

