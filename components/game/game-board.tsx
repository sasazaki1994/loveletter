'use client';

import { useCallback, useEffect, useMemo, type CSSProperties } from "react";
import { AnimatePresence, LayoutGroup } from "framer-motion";

import { ActionBar } from "@/components/game/action-bar";
import { GameTable } from "@/components/game/game-table";
import { HandCard } from "@/components/game/hand-card";
import { LogPanel } from "@/components/game/log-panel";
import { PlayerHUD } from "@/components/game/player-hud";
import { ResultDialog } from "@/components/game/result-dialog";
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
  const orderedPlayers = useMemo(() => {
    if (!state) return [];
    return state.players.slice().sort((a, b) => a.seat - b.seat);
  }, [state]);

  const selfSeat = useMemo(() => {
    if (!state) return 0;
    const me = state.players.find((p) => p.id === selfId);
    return me?.seat ?? 0;
  }, [state, selfId]);

  const getHudPlacementStyle = useCallback(
    (seat: number): CSSProperties => {
      // 自分視点での相対座席番号（0=自分/下, 1=左, 2=上, 3=右）
      const relative = (seat - selfSeat + 4) % 4;
      const BASE_POSITIONS: Record<number, CSSProperties> = {
        0: { left: "50%", top: "84%", transform: "translate(-50%, -50%)" },
        1: { left: "16%", top: "50%", transform: "translate(-50%, -50%)" },
        2: { left: "50%", top: "16%", transform: "translate(-50%, -50%)" },
        3: { left: "84%", top: "50%", transform: "translate(-50%, -50%)" },
      };
      return BASE_POSITIONS[relative] ?? { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
    },
    [selfSeat],
  );

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
    <div className="relative flex h-[100dvh] flex-col overflow-y-auto md:overflow-hidden">
      <AnimatePresence>{state && <TurnBanner state={state} isMyTurn={isMyTurn} />}</AnimatePresence>
      <LogPanel />
      <ResultDialog />
      <div className="fixed left-6 top-6 z-30">
        <SoundControls />
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pt-16 pb-32" role="region" aria-label="ゲームテーブル">
        <div className="flex flex-1 flex-col items-center gap-6">
          <div className="flex flex-1 items-center justify-center">
            <div className="relative aspect-square w-full max-w-[28rem] sm:max-w-[32rem] lg:max-w-[38rem]">
              <GameTable
                drawPileCount={state?.drawPileCount ?? 0}
                discardPile={state?.discardPile ?? []}
                revealedSetupCards={state?.revealedSetupCards ?? []}
              />
              <div className="pointer-events-none absolute inset-0">
                {orderedPlayers.map((player) => (
                  <div key={player.id} className="absolute pointer-events-auto" style={getHudPlacementStyle(player.seat)}>
                    <PlayerHUD
                      player={player}
                      isSelf={player.id === selfId}
                      isActive={state?.activePlayerId === player.id}
                      selectable={player.id !== selfId && isMyTurn && requiresTarget}
                      selected={selectedTarget === player.id}
                      disabled={targetOptionMap.get(player.id)?.disabled}
                      targetReason={targetOptionMap.get(player.id)?.reason}
                      drawPileCount={state?.drawPileCount}
                      onSelectTarget={handleSelectTarget}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="w-full max-w-3xl shrink-0">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Badge variant="outline">あなた</Badge>
              <span className="font-heading text-xl text-[var(--color-accent-light)]">
                {state?.self?.nickname ?? "観戦モード"}
              </span>
              {!isMyTurn && state?.self && !state.self.isEliminated && (
                <span className="text-xs text-[var(--color-text-muted)]">ターン待機中...</span>
              )}
            </div>
            <div className="mt-3 flex min-h-[5.5rem] flex-wrap justify-center gap-4">
              {hand && hand.length > 0 ? (
                <LayoutGroup id="player-hand">
                  <AnimatePresence initial={false}>
                    {hand.map((card, index) => (
                      <HandCard
                        key={`${card}-${index}`}
                        cardId={card}
                        selected={selectedCard === card}
                        disabled={!isMyTurn}
                        onSelect={() => handleCardClick(card)}
                      />
                    ))}
                  </AnimatePresence>
                </LayoutGroup>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">現在手札は表示されていません。</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {state?.self && !state.self.isEliminated && <ActionBar />}
    </div>
  );
}

