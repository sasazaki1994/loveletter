'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { Info, Volume2, VolumeX, Users, BookOpen, ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useGameContext } from "@/components/game/game-provider";
import {
  ACTION_BAR_BOTTOM_DOCK_MAX_HEIGHT,
  ACTION_BAR_LEFT_DOCK_WIDTH_REM,
} from "@/components/game/layout-constants";
import { cn } from "@/lib/utils";
import { CardReferenceDialog } from "@/components/game/card-reference-dialog";

type DockPosition = "left" | "bottom";
const ACTION_BAR_DOCK_EVENT = "action_bar_dock_change";
const ACTION_BAR_HELPER_EXPANDED_KEY = "actionBarHelperExpanded";

function getActionNextStep(params: {
  isMyTurn: boolean;
  hasSelectedCard: boolean;
  cardDefinition?: { requiresGuess?: boolean };
  requiresTarget: boolean;
  noAvailableTargets: boolean;
  selectedTarget: string | null;
  guessedRank: number | null;
  acting: boolean;
  canConfirm: boolean;
}): string {
  if (!params.isMyTurn) return "他のプレイヤーの手番です。進行を待ってください";
  if (params.acting) return "カードを送信中です";
  if (!params.hasSelectedCard) return "カードを1枚選択してください";
  if (params.requiresTarget && !params.noAvailableTargets && !params.selectedTarget) {
    return "対象プレイヤーを選択してください";
  }
  if (params.requiresTarget && params.noAvailableTargets) {
    return "対象がいないため、このままカードを捨て札にできます";
  }
  if (params.cardDefinition?.requiresGuess && !params.noAvailableTargets && (!params.guessedRank || params.guessedRank < 2 || params.guessedRank > 8)) {
    return "推測するランクを 2〜8 で入力してください";
  }
  if (params.canConfirm) return "カードを使用できます";
  return "入力内容を確認してください";
}

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
    tempo,
    setTempo,
    toggleTempo,
  } = useGameContext();

  const [dockPosition, setDockPosition] = useState<DockPosition>("left");
  const [hintVisible, setHintVisible] = useState(false);
  const [gameInfoVisible, setGameInfoVisible] = useState(false);
  const [isCompactHeight, setIsCompactHeight] = useState(false);
  const [isCompactWidth, setIsCompactWidth] = useState(false);
  const [helperPanelExpanded, setHelperPanelExpanded] = useState(false);
  const preferredDockRef = useRef<DockPosition>("left");
  const isDockedLeft = dockPosition === "left";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("actionBarDock");
    if (stored === "left" || stored === "bottom") {
      preferredDockRef.current = stored;
      setDockPosition(stored);
    }
    setHelperPanelExpanded(window.localStorage.getItem(ACTION_BAR_HELPER_EXPANDED_KEY) === "1");

    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const shouldStack = width < 1024;
      setIsCompactWidth(shouldStack);
      setIsCompactHeight(height < 960);
      if (shouldStack) {
        setDockPosition("bottom");
      } else {
        setDockPosition(preferredDockRef.current);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!cardDefinition?.requiresGuess) {
      setGuessedRank(null);
    }
  }, [cardDefinition, setGuessedRank]);

  const setPreferredDock = (dock: DockPosition) => {
    preferredDockRef.current = dock;
    setDockPosition(dock);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("actionBarDock", dock);
      window.dispatchEvent(
        new CustomEvent(ACTION_BAR_DOCK_EVENT, {
          detail: { dock },
        }),
      );
    }
  };

  const toggleHelperPanel = () => {
    setHelperPanelExpanded((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(ACTION_BAR_HELPER_EXPANDED_KEY, next ? "1" : "0");
      }
      if (!next) {
        setHintVisible(false);
        setGameInfoVisible(false);
      }
      return next;
    });
  };

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
    "fixed z-30 flex flex-col gap-3 text-sm text-[var(--color-text-muted)] backdrop-blur-md",
    isDockedLeft
      ? "inset-y-0 right-0 w-full border-l border-[rgba(215,178,110,0.25)] bg-[rgba(10,24,22,0.92)] px-4 py-4 shadow-[-24px_0_60px_rgba(0,0,0,0.5)] bg-table-felt"
      : "inset-x-0 bottom-0 w-full border-t border-[rgba(215,178,110,0.25)] bg-[rgba(10,24,22,0.92)] px-4 py-3 shadow-[0_-24px_60px_rgba(0,0,0,0.5)] sm:px-6 sm:py-4 bg-table-felt",
    isDockedLeft
      ? "scrollbar-thin max-h-[calc(100vh-2.5rem)] overflow-y-auto pr-1"
      : "overflow-y-auto",
    isDockedLeft && isCompactHeight && "pb-6",
    !isDockedLeft && isCompactWidth && "px-4",
  );

  const initialAnimation = useMemo(
    () => (isDockedLeft ? { x: 64, opacity: 0 } : { y: 64, opacity: 0 }),
    [isDockedLeft],
  );

  const animateTo = useMemo(
    () => (isDockedLeft ? { x: 0, opacity: 1 } : { y: 0, opacity: 1 }),
    [isDockedLeft],
  );

  const actionBarStyle = useMemo<CSSProperties>(
    () =>
      isDockedLeft
        ? { maxWidth: `${ACTION_BAR_LEFT_DOCK_WIDTH_REM}rem` }
        : {
            maxHeight: ACTION_BAR_BOTTOM_DOCK_MAX_HEIGHT,
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
          },
    [isDockedLeft],
  );

  const innerClasses = cn(
    "flex flex-col",
    isDockedLeft
      ? "gap-3"
      : cn("mx-auto w-full max-w-5xl", isCompactWidth ? "gap-2.5 px-1" : "gap-3"),
  );

  const infoRowClasses = cn(
    "text-sm text-[var(--color-text-muted)]",
    isDockedLeft
      ? "flex flex-col gap-2"
      : isCompactWidth
        ? "flex flex-col gap-2"
        : "flex flex-wrap items-center gap-3",
  );

  const stackControls = isDockedLeft || isCompactWidth;

  const controlsRowClasses = cn(
    "flex gap-3",
    isDockedLeft ? "flex-col" : stackControls ? "flex-col" : "flex-wrap items-center",
  );
  const showHelperDetails = !isDockedLeft || helperPanelExpanded;
  const nextStepMessage = getActionNextStep({
    isMyTurn,
    hasSelectedCard: Boolean(selectedCard),
    cardDefinition,
    requiresTarget,
    noAvailableTargets,
    selectedTarget,
    guessedRank,
    acting,
    canConfirm,
  });

  return (
    <motion.div
      className={containerClasses}
      initial={initialAnimation}
      animate={animateTo}
      transition={{ duration: 0.25, ease: "easeOut" }}
      aria-live="polite"
      style={actionBarStyle}
    >
      <div className={innerClasses}>
        <div className="flex flex-col gap-3">
          <div className={infoRowClasses}>
            {isDockedLeft ? (
              <>
                <div className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.1)] pb-2">
                  <Info className="h-4 w-4 text-[var(--color-accent-light)]" />
                  <span className="text-xs leading-tight">
                    {isMyTurn ? "カードを選択して Enter で使用" : "待機中"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[rgba(215,178,110,0.2)] bg-[rgba(12,32,30,0.7)] px-2 py-1.5">
                  <span className="text-[10px] uppercase tracking-[0.3em] text-[rgba(215,178,110,0.75)]">
                    補助と設定
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-7 px-2 text-[10px]"
                    onClick={toggleHelperPanel}
                    aria-expanded={showHelperDetails}
                    aria-label={showHelperDetails ? "補助パネルを折りたたむ" : "補助パネルを展開する"}
                  >
                    {showHelperDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    {showHelperDetails ? "閉じる" : "表示"}
                  </Button>
                </div>
                {showHelperDetails && (
                  <>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="px-1.5 py-0.5 text-[10px]">
                          ← / →
                        </Badge>
                        <span>カード</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="px-1.5 py-0.5 text-[10px]">
                          ↑ / ↓
                        </Badge>
                        <span>対象</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="px-1.5 py-0.5 text-[10px]">
                          2-8
                        </Badge>
                        <span>推測</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="px-1.5 py-0.5 text-[10px]">
                          Enter
                        </Badge>
                        <span>使用</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="px-1.5 py-0.5 text-[10px]">
                          Esc
                        </Badge>
                        <span>キャンセル</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 border-t border-[rgba(255,255,255,0.1)] pt-2">
                      <div className="flex items-center gap-2 px-1.5">
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
                      <div className="flex items-center gap-2 px-1.5">
                        <span className="text-[10px] uppercase tracking-[0.3em] text-[rgba(215,178,110,0.75)]">
                          テンポ
                        </span>
                        <div className="ml-auto flex gap-1">
                          <Button
                            type="button"
                            variant={tempo === "normal" ? "primary" : "outline"}
                            className="h-7 px-2 py-1 text-[10px]"
                            onClick={() => setTempo("normal")}
                            aria-pressed={tempo === "normal"}
                          >
                            通常
                          </Button>
                          <Button
                            type="button"
                            variant={tempo === "fast" ? "primary" : "outline"}
                            className="h-7 px-2 py-1 text-[10px]"
                            onClick={() => setTempo("fast")}
                            aria-pressed={tempo === "fast"}
                          >
                            高速
                          </Button>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        className="h-7 w-full justify-start px-2 text-xs"
                        onClick={() => setPreferredDock("bottom")}
                      >
                        下部に表示
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-7 w-full justify-start px-2 text-xs"
                        onClick={() => setHintVisible((prev) => !prev)}
                        aria-expanded={hintVisible}
                      >
                        {hintVisible ? "ヒントを隠す" : "カード効果ヒント"}
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-7 w-full justify-start gap-2 px-2 text-xs"
                        onClick={() => setGameInfoVisible((prev) => !prev)}
                        aria-expanded={gameInfoVisible}
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        {gameInfoVisible ? "ガイドを隠す" : "ゲームガイド"}
                      </Button>
                      <CardReferenceDialog />
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <span className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-[var(--color-accent-light)]" />
                  {isMyTurn ? "カードを選択して Enter で使用できます" : "他プレイヤーの行動を待機中"}
                </span>
                <Badge variant="outline">← / →</Badge>
                <span>カード</span>
                <Badge variant="outline">↑ / ↓</Badge>
                <span>対象</span>
                <Badge variant="outline">2-8</Badge>
                <span>推測</span>
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
                    type="button"
                    variant={tempo === "fast" ? "primary" : "outline"}
                    className="h-8 px-3 text-xs"
                    onClick={toggleTempo}
                    aria-pressed={tempo === "fast"}
                    aria-label={tempo === "fast" ? "テンポを通常に戻す" : "テンポを高速にする"}
                  >
                    テンポ: {tempo === "fast" ? "高速" : "通常"}
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-8 px-3 text-xs"
                    onClick={() => setPreferredDock("left")}
                  >
                    左に表示
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-8 px-3 text-xs"
                    onClick={() => setHintVisible((prev) => !prev)}
                    aria-expanded={hintVisible}
                  >
                    {hintVisible ? "ヒントを隠す" : "カード効果ヒント"}
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-8 gap-2 px-3 text-xs"
                    onClick={() => setGameInfoVisible((prev) => !prev)}
                    aria-expanded={gameInfoVisible}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    {gameInfoVisible ? "ガイドを隠す" : "ゲームガイド"}
                  </Button>
                  <CardReferenceDialog />
                </div>
              </>
            )}
          </div>

          {actionError && (
            <div
              className="flex items-start justify-between gap-4 rounded-xl border border-[rgba(215,120,110,0.35)] bg-[rgba(60,20,18,0.65)] px-4 py-3 text-sm text-[var(--color-warn-light)]"
              role="alert"
            >
              <span>{actionError}</span>
              <Button
                variant="ghost"
                className="h-8 px-3 text-xs text-[var(--color-warn-light)]"
                onClick={clearActionError}
              >
                閉じる
              </Button>
            </div>
          )}

          {showHelperDetails && gameInfoVisible && (
            <div
              className={cn(
                "flex flex-col gap-4 rounded-xl border border-[rgba(215,178,110,0.25)] bg-[rgba(12,32,30,0.95)] px-4 py-3 text-sm text-[var(--color-text-muted)] shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-2 fade-in",
                isDockedLeft ? "px-3 py-3 max-h-[60vh] overflow-y-auto scrollbar-thin" : "max-h-[18rem] overflow-y-auto scrollbar-thin",
              )}
            >
              <div>
                <p className={cn("font-heading text-[var(--color-accent-light)] mb-2", isDockedLeft ? "text-sm" : "text-lg")}>Love Letter Reverie</p>
                <ul
                  className={cn(
                    "list-disc space-y-1 pl-5 leading-relaxed text-xs",
                    isDockedLeft && "pl-4",
                  )}
                >
                  <li>山札から1枚引き、手札2枚のうち1枚を使います。</li>
                  <li>最後まで生き残るか、山札切れ時に最強ランクを持つと勝利です。</li>
                  <li>守護状態の相手は対象にできません。</li>
                </ul>
              </div>

              <div className="border-t border-[rgba(215,178,110,0.15)] pt-3">
                <h4 className="mb-2 flex items-center gap-2 font-heading text-sm text-[var(--color-accent-light)]">
                  <Info className="h-3 w-3" />
                  操作キー
                </h4>
                <div className="grid gap-1.5 text-xs">
                  <p>←/→: カード選択</p>
                  <p>↑/↓: 対象選択</p>
                  <p>2-8: 推測ランク入力</p>
                  <p>Enter: 使用 / Esc: キャンセル</p>
                </div>
              </div>

              <div className="rounded-lg border border-[rgba(215,178,110,0.2)] bg-[rgba(10,24,22,0.7)] px-3 py-2 text-xs">
                詳細なカード効果は「カード一覧」ボタンで確認できます。
              </div>
            </div>
          )}

          {showHelperDetails && hintVisible && cardDefinition && !gameInfoVisible && (
            <div
              className={cn(
                "rounded-xl border border-[rgba(215,178,110,0.25)] bg-[rgba(12,32,30,0.65)] px-4 py-3 text-sm text-[var(--color-text-muted)] animate-in slide-in-from-bottom-2 fade-in",
                isDockedLeft && "px-3 py-2",
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
            <p data-testid="action-selected-card" className={cn("text-[var(--color-accent-light)]", isDockedLeft ? "text-xs" : "text-sm")}> 
              {cardDefinition ? `${cardDefinition.name} (ランク ${cardDefinition.rank})` : "未選択"}
            </p>
          </div>
          <div className={cn("flex flex-col gap-1", isDockedLeft ? "w-full" : "min-w-[18rem]")}>
            <span className="text-xs uppercase tracking-[0.3em] text-[var(--color-text-muted)]">次にやること</span>
            <p data-testid="action-next-step" className={cn("text-[var(--color-text)]", isDockedLeft ? "text-xs" : "text-sm")}>
              {nextStepMessage}
            </p>
          </div>

          {requiresTarget && (
            <div data-testid="action-target-section" className={cn("flex flex-col gap-1.5", isDockedLeft ? "w-full" : "text-sm")}> 
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
                      className={cn(
                        "gap-2 px-3 text-xs",
                        isDockedLeft || isCompactWidth ? "h-8 w-full justify-start" : "h-9",
                      )}
                      disabled={target.disabled}
                      onClick={() => setSelectedTarget(target.id)}
                    >
                      <Users className="h-3.5 w-3.5 opacity-70" />
                      <span>{target.label}</span>
                      {target.badges.length > 0 && (
                        <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">
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
                data-testid="action-guess-input"
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
                  if (!Number.isNaN(numValue)) {
                    setGuessedRank(numValue);
                  }
                }}
                onBlur={(event) => {
                  const value = event.target.value.trim();
                  if (value === "") {
                    setGuessedRank(null);
                  } else {
                    const numValue = Number(value);
                    if (!Number.isNaN(numValue)) {
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
                className={cn(isDockedLeft || isCompactWidth ? "h-8 w-full" : "h-9 w-28")}
              />
            </div>
          )}

          <div className={cn("flex gap-2", stackControls ? "w-full flex-col pt-0" : "ml-auto gap-3")}> 
            <Button
              data-testid="action-cancel-button"
              variant="ghost"
              className={cn(stackControls ? "h-9 w-full justify-center" : "px-4")}
              onClick={cancelSelection}
              disabled={!selectedCard}
            >
              取り消し
            </Button>
            <Button
              data-testid="action-confirm-button"
              className={cn(stackControls ? "h-10 w-full" : "px-6")}
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
