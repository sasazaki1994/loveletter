'use client';

import { useCallback, useEffect, useMemo } from "react";
import { AnimatePresence } from "framer-motion";

import { ActionBar } from "@/components/game/action-bar";
import { GameTable } from "@/components/game/game-table";
import { HandCard } from "@/components/game/hand-card";
import { LogPanel } from "@/components/game/log-panel";
import { PlayerHUD } from "@/components/game/player-hud";
import { ResultDialog } from "@/components/game/result-dialog";
import { SeatMap } from "@/components/game/seat-map";
import { SoundControls } from "@/components/game/sound-controls";
import { TurnBanner } from "@/components/game/turn-banner";
import { useGameContext } from "@/components/game/game-provider";
import { Badge } from "@/components/ui/badge";

export function GameBoard() {
  const {
    state,
    selectedCard,
    setSelectedCard,
    selectedTarget,
    setSelectedTarget,
    isMyTurn,
    selfId,
    playCard,
    cancelSelection,
    requiresTarget,
    targetOptions,
  } = useGameContext();

  const hand = useMemo(() => state?.hand ?? state?.self?.hand ?? [], [state?.hand, state?.self?.hand]);
  const opponents = useMemo(() => {
    if (!state) return [];
    return state.players.slice().sort((a, b) => a.seat - b.seat);
  }, [state]);

  const targetOptionMap = useMemo(() => {
    const map = new Map<string, (typeof targetOptions)[number]>();
    targetOptions.forEach((option) => {
      map.set(option.id, option);
    });
    return map;
  }, [targetOptions]);

  const handleCardClick = useCallback(
    (card: typeof hand[number]) => {
      if (!isMyTurn) return;
      setSelectedCard((prev) => (prev === card ? null : card));
    },
    [isMyTurn, setSelectedCard],
  );

  const handleSelectTarget = useCallback(
    (playerId: string) => {
      setSelectedTarget((prev) => (prev === playerId ? null : playerId));
    },
    [setSelectedTarget],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isMyTurn) return;

      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        if (hand.length === 0) return;
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const currentIndex = selectedCard ? hand.findIndex((card) => card === selectedCard) : -1;
        const nextIndex = currentIndex === -1 ? (direction === 1 ? 0 : hand.length - 1) : (currentIndex + direction + hand.length) % hand.length;
        setSelectedCard(hand[nextIndex]);
      }

      if (event.key === "Enter" || event.key === " ") {
        if (hand.length === 0) return;
        event.preventDefault();
        if (!selectedCard) {
          setSelectedCard(hand[0]);
        } else {
          void playCard();
        }
      }

      if (event.key === "Escape") {
        event.preventDefault();
        cancelSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [cancelSelection, hand, isMyTurn, playCard, selectedCard, setSelectedCard]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center pb-36 pt-20">
      <AnimatePresence>{state && <TurnBanner state={state} isMyTurn={isMyTurn} />}</AnimatePresence>
      <LogPanel />
      <ResultDialog />
      <div className="fixed left-6 top-6 z-30">
        <SoundControls />
      </div>

      <div
        className="grid w-full max-w-6xl grid-rows-[auto_auto_auto] gap-6"
        role="region"
        aria-label="ゲームテーブル"
      >
        <div className="flex w-full justify-center">
          <div className="flex flex-wrap items-start justify-center gap-4">
            {opponents
              .filter((player) => player.id !== selfId)
              .map((player) => (
                <PlayerHUD
                  key={player.id}
                  player={player}
                  isSelf={player.id === selfId}
                  isActive={state?.activePlayerId === player.id}
                  selectable={isMyTurn && requiresTarget}
                  selected={selectedTarget === player.id}
                  disabled={targetOptionMap.get(player.id)?.disabled}
                  targetReason={targetOptionMap.get(player.id)?.reason}
                  onSelectTarget={handleSelectTarget}
                />
              ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <GameTable
            drawPileCount={state?.drawPileCount ?? 0}
            discardPile={state?.discardPile ?? []}
            revealedSetupCards={state?.revealedSetupCards ?? []}
          />
          <SeatMap state={state ?? null} selfId={selfId} />
        </div>

        <div className="relative mt-6 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline">あなた</Badge>
            <span className="font-heading text-xl text-[var(--color-accent-light)]">
              {state?.self?.nickname ?? "観戦モード"}
            </span>
            {!isMyTurn && state?.self && !state.self.isEliminated && (
              <span className="text-xs text-[var(--color-text-muted)]">ターン待機中...</span>
            )}
          </div>
          <div className="flex gap-4">
            {hand && hand.length > 0 ? (
              hand.map((card, index) => (
                <HandCard
                  key={`${card}-${index}`}
                  cardId={card}
                  selected={selectedCard === card}
                  disabled={!isMyTurn}
                  onSelect={() => handleCardClick(card)}
                />
              ))
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">現在手札は表示されていません。</p>
            )}
          </div>
        </div>
      </div>

      {state?.self && !state.self.isEliminated && <ActionBar />}
    </div>
  );
}

