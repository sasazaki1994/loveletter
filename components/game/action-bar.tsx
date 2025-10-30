'use client';

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useGameContext } from "@/components/game/game-provider";

export function ActionBar() {
  const {
    selectedCard,
    selectedTarget,
    setSelectedTarget,
    guessedRank,
    setGuessedRank,
    playCard,
    cancelSelection,
    isMyTurn,
    acting,
    cardDefinition,
    requiresTarget,
    targetOptions,
    noAvailableTargets,
  } = useGameContext();

  const [hintVisible, setHintVisible] = useState(false);

  useEffect(() => {
    if (!cardDefinition?.requiresGuess) {
      setGuessedRank(null);
    }
  }, [cardDefinition, setGuessedRank]);

  const canConfirm = useMemo(() => {
    if (!isMyTurn || !cardDefinition) return false;
    if (cardDefinition.requiresGuess && (!guessedRank || guessedRank === 1) && !noAvailableTargets) {
      return false;
    }
    if (requiresTarget && !noAvailableTargets) {
      const selectedOption = targetOptions.find(
        (option) => option.id === selectedTarget && !option.disabled,
      );
      if (!selectedOption) return false;
    }
    return true;
  }, [cardDefinition, guessedRank, isMyTurn, noAvailableTargets, requiresTarget, selectedTarget, targetOptions]);

  return (
    <motion.div
      className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[rgba(8,20,18,0.95)] to-[rgba(12,32,30,0.72)] px-6 py-4 shadow-[0_-24px_60px_rgba(0,0,0,0.45)]"
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      aria-live="polite"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--color-text-muted)]">
          <span className="flex items-center gap-2">
            <Info className="h-4 w-4 text-[var(--color-accent-light)]" />
            {isMyTurn ? "カードを選択して Enter で使用できます" : "他プレイヤーの行動を待機中"}
          </span>
          <Badge variant="outline">Tab</Badge>
          <span>フォーカス移動</span>
          <Badge variant="outline">Enter</Badge>
          <span>使用</span>
          <Badge variant="outline">Esc</Badge>
          <span>キャンセル</span>
          <Button
            variant="ghost"
            className="ml-auto h-8 px-3 text-xs"
            onClick={() => setHintVisible((prev) => !prev)}
          >
            {hintVisible ? "ヒントを隠す" : "カード効果ヒント"}
          </Button>
        </div>

        {hintVisible && cardDefinition && (
          <div className="rounded-xl border border-[rgba(215,178,110,0.25)] bg-[rgba(12,32,30,0.65)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
            <p className="font-heading text-lg text-[var(--color-accent-light)]">{cardDefinition.name}</p>
            <p className="mt-1">{cardDefinition.description}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[14rem] flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
              選択中カード
            </span>
            <p className="text-sm text-[var(--color-accent-light)]">
              {cardDefinition ? `${cardDefinition.name} (ランク ${cardDefinition.rank})` : "未選択"}
            </p>
          </div>

          {requiresTarget && (
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-xs uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
                対象プレイヤー
              </span>
              {noAvailableTargets ? (
                <p className="text-xs text-[var(--color-text-muted)]">
                  有効な対象がいないため効果は発動しません。このままカードを捨て札にできます。
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {targetOptions.map((target) => (
                    <Button
                      key={target.id}
                      variant={selectedTarget === target.id ? "primary" : "outline"}
                      className="h-9 px-3 text-xs"
                      disabled={target.disabled}
                      onClick={() => setSelectedTarget(target.id)}
                    >
                      <span>{target.label}</span>
                      {target.badges.length > 0 && (
                        <span className="ml-2 text-[10px] text-[var(--color-text-muted)]">
                          {target.badges.join(" / ")}
                        </span>
                      )}
                      {target.reason && (
                        <span className="ml-2 text-[10px] text-[var(--color-text-muted)]">
                          {target.reason}
                        </span>
                      )}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          {cardDefinition?.requiresGuess && (
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-xs uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
                推測するランク
              </span>
              <Input
                type="number"
                min={2}
                max={8}
                value={guessedRank ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setGuessedRank(value ? Number(value) : null);
                }}
                className="h-9 w-28"
              />
            </div>
          )}

          <div className="ml-auto flex gap-3">
            <Button variant="ghost" className="px-4" onClick={cancelSelection} disabled={!selectedCard}>
              取り消し
            </Button>
            <Button className="px-6" onClick={playCard} disabled={!canConfirm || acting}>
              {acting ? "送信中..." : "カードを使う"}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

