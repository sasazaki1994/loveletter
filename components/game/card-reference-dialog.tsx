'use client';

import { useMemo, useState } from "react";
import { BookOpen, HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CardSymbol } from "@/components/icons/card-symbol";
import { useGameContext } from "@/components/game/game-provider";
import { CARD_DEFINITIONS, ORDERED_CARD_IDS } from "@/lib/game/cards";
import type { CardId } from "@/lib/game/types";
import { cn } from "@/lib/utils";

const EXCLUDED_FROM_REFERENCE = ['feint', 'insight', 'standoff', 'wager', 'ambush', 'marquise'];

export function CardReferenceDialog() {
  const { state, selfId } = useGameContext();
  const [open, setOpen] = useState(false);

  // カウンティングロジック
  const cardCounts = useMemo(() => {
    const counts: Record<CardId, { total: number; visible: number; remaining: number }> = {} as any;
    
    // 初期化
    ORDERED_CARD_IDS.forEach(id => {
      if (EXCLUDED_FROM_REFERENCE.includes(id)) return;
      const def = CARD_DEFINITIONS[id];
      counts[id] = { total: def.copies, visible: 0, remaining: def.copies };
    });

    if (!state) return counts;

    // 捨て札を集計
    state.discardPile.forEach(cardId => {
      if (counts[cardId]) counts[cardId].visible++;
    });

    // セットアップ時の公開カードを集計
    state.revealedSetupCards.forEach(cardId => {
      if (counts[cardId]) counts[cardId].visible++;
    });

    // 自分の手札を集計（自分だけが知っている情報）
    if (state.hand) {
      state.hand.forEach(cardId => {
        if (counts[cardId]) counts[cardId].visible++;
      });
    }

    // peekなどで一時的に見えているカード（厳密な実装はstate.effectHintsなどを見る必要があるが、
    // ここではシンプルに「確定情報」としてログやdiscardPile、自分の手札を重視する）

    // 残り枚数計算
    Object.keys(counts).forEach(key => {
      const id = key as CardId;
      // visibleがtotalを超えることは理論上ないはずだが、バグや拡張ルールへの防御
      counts[id].remaining = Math.max(0, counts[id].total - counts[id].visible);
    });

    return counts;
  }, [state]);

  const cards = useMemo(() => {
    return ORDERED_CARD_IDS
      .filter(id => !EXCLUDED_FROM_REFERENCE.includes(id))
      .map(id => {
        const def = CARD_DEFINITIONS[id];
        const count = cardCounts[id] || { total: def.copies, visible: 0, remaining: def.copies };
        return { ...def, ...count };
      })
      .sort((a, b) => a.rank - b.rank);
  }, [cardCounts]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 w-9 rounded-full border border-[rgba(215,178,110,0.25)] bg-[rgba(12,32,30,0.7)] p-0 text-[var(--color-accent-light)] shadow-[0_4px_12px_rgba(0,0,0,0.3)] hover:bg-[rgba(20,45,40,0.8)]"
          aria-label="カード一覧"
        >
          <BookOpen className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] border-[rgba(215,178,110,0.3)] bg-[rgba(12,28,26,0.95)] p-0 text-[var(--color-text)] backdrop-blur-xl sm:max-w-[420px]">
        <DialogHeader className="px-6 py-4 border-b border-[rgba(255,255,255,0.1)]">
          <DialogTitle className="flex items-center gap-2 font-heading text-xl text-[var(--color-accent-light)]">
            <BookOpen className="h-5 w-5" />
            カード一覧
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-full max-h-[calc(85vh-4rem)] px-6 py-4">
          <div className="space-y-4 pb-4">
            <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] px-2">
              <span>ランク / 効果</span>
              <span>残り / 合計</span>
            </div>
            
            <div className="space-y-2">
              {cards.map((card) => {
                const isEliminated = card.remaining === 0;
                const percentage = Math.round((card.remaining / card.total) * 100);
                
                return (
                  <div 
                    key={card.id} 
                    className={cn(
                      "group relative overflow-hidden rounded-lg border p-2.5 transition-all",
                      isEliminated 
                        ? "border-[rgba(255,255,255,0.05)] bg-[rgba(0,0,0,0.2)] opacity-60" 
                        : "border-[rgba(215,178,110,0.2)] bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.06)] hover:border-[rgba(215,178,110,0.4)]"
                    )}
                  >
                    {/* Progress Background */}
                    <div 
                      className="absolute bottom-0 left-0 top-0 bg-[rgba(215,178,110,0.05)] transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />

                    <div className="relative flex items-start gap-3">
                      <div className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded border font-heading text-lg font-bold",
                        isEliminated
                          ? "border-[rgba(255,255,255,0.1)] text-[var(--color-text-muted)]"
                          : "border-[rgba(215,178,110,0.4)] bg-[rgba(215,178,110,0.1)] text-[var(--color-accent-light)]"
                      )}>
                        {card.rank}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CardSymbol icon={card.icon} size={14} className={cn("opacity-80", isEliminated && "grayscale")} />
                            <span className={cn("font-medium text-sm", isEliminated ? "text-[var(--color-text-muted)]" : "text-[var(--color-accent-light)]")}>
                              {card.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {/* 残り枚数インジケーター */}
                            <div className="flex gap-0.5">
                              {Array.from({ length: card.total }).map((_, i) => (
                                <div 
                                  key={i} 
                                  className={cn(
                                    "h-1.5 w-1.5 rounded-full transition-colors",
                                    i < card.remaining 
                                      ? "bg-[var(--color-accent)] shadow-[0_0_4px_var(--color-accent)]" 
                                      : "bg-[rgba(255,255,255,0.1)]"
                                  )} 
                                />
                              ))}
                            </div>
                            <span className="ml-1 text-xs font-mono text-[var(--color-text-muted)]">
                              {card.remaining}/{card.total}
                            </span>
                          </div>
                        </div>
                        
                        <p className="text-xs leading-relaxed text-[var(--color-text-muted)] opacity-90">
                          {card.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(0,0,0,0.2)] p-3 text-xs text-[var(--color-text-muted)]">
              <div className="flex items-start gap-2">
                <HelpCircle className="h-4 w-4 shrink-0 opacity-70" />
                <p>
                  「残り」は、捨て札や公開カード、自分の手札から逆算した値です。
                  他プレイヤーの手札や山札に含まれている可能性があります。
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
