'use client';

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Info, Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useGameContext } from "@/components/game/game-provider";
import { cn } from "@/lib/utils";

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
    actionError,
    clearActionError,
    muted,
    toggleMute,
    volume,
    setVolume,
  } = useGameContext();

  const [hintVisible, setHintVisible] = useState(false);
  const [gameInfoVisible, setGameInfoVisible] = useState(false);
  const [dockPosition, setDockPosition] = useState<"bottom" | "left">("left");
  const isDockedLeft = dockPosition === "left";

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("actionBarDock", dockPosition);
  }, [dockPosition]);

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

  const containerClasses = cn(
    "fixed z-30",
    isDockedLeft
      ? "inset-y-0 right-0 w-full max-w-[20rem] bg-gradient-to-l from-[rgba(8,20,18,0.95)] to-[rgba(12,32,30,0.72)] px-4 py-4 shadow-[-24px_0_60px_rgba(0,0,0,0.45)]"
      : "inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(8,20,18,0.95)] to-[rgba(12,32,30,0.72)] px-6 py-4 shadow-[0_-24px_60px_rgba(0,0,0,0.45)]",
  );

  const initialAnimation = useMemo(
    () => (isDockedLeft ? { x: -80, opacity: 0 } : { y: 80, opacity: 0 }),
    [isDockedLeft],
  );

  const animateTo = useMemo(
    () => (isDockedLeft ? { x: 0, opacity: 1 } : { y: 0, opacity: 1 }),
    [isDockedLeft],
  );

  const innerClasses = cn(
    "flex flex-col",
    isDockedLeft ? "h-full gap-3" : "mx-auto w-full max-w-5xl gap-3",
  );

  const infoRowClasses = cn(
    "text-sm text-[var(--color-text-muted)]",
    isDockedLeft ? "flex flex-col gap-2" : "flex flex-wrap items-center gap-3",
  );

  const controlsRowClasses = cn(
    "flex gap-3",
    isDockedLeft ? "flex-col" : "flex-wrap items-center",
  );

  return (
    <motion.div
      className={containerClasses}
      initial={initialAnimation}
      animate={animateTo}
      transition={{ duration: 0.25, ease: "easeOut" }}
      aria-live="polite"
    >
      <div className={innerClasses}>
        <div className="flex flex-col gap-3">
          <div className={infoRowClasses}>
            {isDockedLeft ? (
              <>
                <div className="flex items-center gap-2 pb-2 border-b border-[rgba(255,255,255,0.1)]">
                  <Info className="h-4 w-4 text-[var(--color-accent-light)]" />
                  <span className="text-xs leading-tight">
                    {isMyTurn ? "カードを選択して Enter で使用" : "待機中"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">Tab</Badge>
                    <span>移動</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">Enter</Badge>
                    <span>使用</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">Esc</Badge>
                    <span>キャンセル</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 pt-2 border-t border-[rgba(255,255,255,0.1)]">
                  <div className="flex items-center gap-2 px-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-[var(--color-accent-light)]"
                      onClick={toggleMute}
                      aria-pressed={muted}
                      aria-label={muted ? "ミュート解除" : "ミュート"}
                    >
                      {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                    </Button>
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        id="volume-slider-left"
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(volume * 100)}
                        onChange={(event) => setVolume(Number(event.target.value) / 100)}
                        className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-[rgba(215,178,110,0.25)]"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(volume * 100)}
                        aria-label="音量スライダー"
                      />
                      <span className="w-9 text-right text-[10px] text-[var(--color-accent-light)]">
                        {Math.round(volume * 100)}%
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    className="h-7 w-full justify-start px-2 text-xs"
                    onClick={() => setDockPosition("bottom")}
                  >
                    下部に表示
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-7 w-full justify-start px-2 text-xs"
                    onClick={() => setHintVisible((prev) => !prev)}
                  >
                    {hintVisible ? "ヒントを隠す" : "カード効果ヒント"}
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-7 w-full justify-start px-2 text-xs"
                    onClick={() => setGameInfoVisible((prev) => !prev)}
                  >
                    {gameInfoVisible ? "ゲーム概要を隠す" : "ゲーム概要"}
                  </Button>
                </div>
              </>
            ) : (
              <>
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
                <div className="ml-auto flex items-center gap-3">
                  <div className="flex items-center gap-2 rounded-full border border-[rgba(215,178,110,0.25)] bg-[rgba(12,32,30,0.7)] px-3 py-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-[var(--color-accent-light)]"
                      onClick={toggleMute}
                      aria-pressed={muted}
                      aria-label={muted ? "ミュート解除" : "ミュート"}
                    >
                      {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                    </Button>
                    <input
                      id="volume-slider-bottom"
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(volume * 100)}
                      onChange={(event) => setVolume(Number(event.target.value) / 100)}
                      className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-[rgba(215,178,110,0.25)]"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(volume * 100)}
                      aria-label="音量スライダー"
                    />
                    <span className="w-8 text-right text-[10px] text-[var(--color-accent-light)]">
                      {Math.round(volume * 100)}%
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    className="h-8 px-3 text-xs"
                    onClick={() => setDockPosition("left")}
                  >
                    左に表示
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-8 px-3 text-xs"
                    onClick={() => setHintVisible((prev) => !prev)}
                  >
                    {hintVisible ? "ヒントを隠す" : "カード効果ヒント"}
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-8 px-3 text-xs"
                    onClick={() => setGameInfoVisible((prev) => !prev)}
                  >
                    {gameInfoVisible ? "ゲーム概要を隠す" : "ゲーム概要"}
                  </Button>
                </div>
              </>
            )}
          </div>

        {actionError && (
          <div className="flex items-start justify-between gap-4 rounded-xl border border-[rgba(215,120,110,0.35)] bg-[rgba(60,20,18,0.65)] px-4 py-3 text-sm text-[var(--color-warn-light)]" role="alert">
            <span>{actionError}</span>
            <Button variant="ghost" className="h-8 px-3 text-xs text-[var(--color-warn-light)]" onClick={clearActionError}>
              閉じる
            </Button>
          </div>
        )}

          {gameInfoVisible && (
            <div
              className={cn(
                "space-y-2 rounded-xl border border-[rgba(215,178,110,0.25)] bg-[rgba(12,32,30,0.65)] px-4 py-3 text-sm text-[var(--color-text-muted)]",
                isDockedLeft && "px-3 py-2 text-xs"
              )}
            >
              <p className={cn("font-heading text-[var(--color-accent-light)]", isDockedLeft ? "text-sm" : "text-lg")}>Love Letter Reverie</p>
              <ul
                className={cn(
                  "list-disc space-y-1 leading-relaxed pl-5",
                  isDockedLeft && "pl-4"
                )}
              >
                <li>各ターンで山札から1枚引き、手札2枚のうち1枚を公開して効果を解決します。</li>
                <li>効果で相手を脱落させるか、自分が脱落しないように立ち回ります。</li>
                <li>山札が尽きるか1人だけ残るとラウンド終了。生存者の中で最も高ランクのカードが勝利します。</li>
              </ul>
            </div>
          )}

          {hintVisible && cardDefinition && (
            <div
              className={cn(
                "rounded-xl border border-[rgba(215,178,110,0.25)] bg-[rgba(12,32,30,0.65)] px-4 py-3 text-sm text-[var(--color-text-muted)]",
                isDockedLeft && "px-3 py-2"
              )}
            >
              <p className={cn("font-heading text-[var(--color-accent-light)]", isDockedLeft ? "text-sm" : "text-lg")}>{cardDefinition.name}</p>
              <p className={cn("mt-1", isDockedLeft && "text-xs")}>{cardDefinition.description}</p>
            </div>
          )}
        </div>

        <div className={controlsRowClasses}>
          <div className={cn("flex flex-col gap-1", isDockedLeft ? "w-full" : "min-w-[14rem]")}>
            <span className="text-xs uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
              選択中カード
            </span>
            <p className={cn("text-[var(--color-accent-light)]", isDockedLeft ? "text-xs" : "text-sm")}>
              {cardDefinition ? `${cardDefinition.name} (ランク ${cardDefinition.rank})` : "未選択"}
            </p>
          </div>

          {requiresTarget && (
            <div className={cn("flex flex-col gap-1.5", isDockedLeft ? "w-full" : "text-sm")}>
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
                      className={cn("px-3 text-xs", isDockedLeft ? "h-8 w-full justify-start" : "h-9")}
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
            <div className={cn("flex flex-col gap-1.5", isDockedLeft ? "w-full" : "text-sm")}>
              <span className="text-xs uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
                推測するランク
              </span>
              <Input
                type="number"
                min={2}
                max={8}
                step={1}
                value={guessedRank !== null && guessedRank !== undefined ? String(guessedRank) : ""}
                onChange={(event) => {
                  const value = event.target.value.trim();
                  if (value === "") {
                    setGuessedRank(null);
                    return;
                  }
                  const numValue = Number(value);
                  if (!isNaN(numValue)) {
                    setGuessedRank(numValue);
                  }
                }}
                onBlur={(event) => {
                  const value = event.target.value.trim();
                  if (value === "") {
                    setGuessedRank(null);
                  } else {
                    const numValue = Number(value);
                    if (!isNaN(numValue)) {
                      if (numValue < 2) {
                        setGuessedRank(null);
                      } else if (numValue > 8) {
                        setGuessedRank(8);
                      } else {
                        setGuessedRank(Math.floor(numValue));
                      }
                    } else {
                      setGuessedRank(null);
                    }
                  }
                }}
                className={cn(isDockedLeft ? "h-8 w-full" : "h-9 w-28")}
              />
            </div>
          )}

          <div className={cn("flex gap-2", isDockedLeft ? "w-full flex-col pt-0" : "ml-auto gap-3")}>
            <Button 
              variant="ghost" 
              className={cn(isDockedLeft ? "w-full h-9 justify-center" : "px-4")} 
              onClick={cancelSelection} 
              disabled={!selectedCard}
            >
              取り消し
            </Button>
            <Button 
              className={cn(isDockedLeft ? "w-full h-10" : "px-6")} 
              onClick={playCard} 
              disabled={!canConfirm || acting}
            >
              {acting ? "送信中..." : "カードを使う"}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

