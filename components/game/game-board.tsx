'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
import { CARD_DEFINITIONS } from "@/lib/game/cards";

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

  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const [tableSize, setTableSize] = useState({ width: 0, height: 0 });
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

  useEffect(() => {
    const element = tableContainerRef.current;
    if (!element) return;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      const styles = window.getComputedStyle(element);
      const maxWidth = parseFloat(styles.maxWidth) || 0;
      const parentRect = element.parentElement?.getBoundingClientRect();
      const viewportAvailable = Math.max(window.innerWidth - 96, 240);

      const candidates = [
        rect.width,
        element.offsetWidth,
        element.clientWidth,
        parentRect?.width ?? 0,
        maxWidth,
        viewportAvailable,
      ].filter((value) => Number.isFinite(value) && value > 0);

      const fallback = maxWidth > 0 ? Math.min(maxWidth, viewportAvailable) : viewportAvailable;
      const width = candidates.length > 0 ? Math.min(...candidates) : fallback;
      const clamped = Math.max(260, width);

      setTableSize((prev) => {
        if (Math.abs(prev.width - clamped) < 1 && Math.abs(prev.height - clamped) < 1) {
          return prev;
        }
        return { width: clamped, height: clamped };
      });
    };

    measure();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(measure);
      resizeObserver.observe(element);
    }

    window.addEventListener("resize", measure);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const getHudPlacementStyle = useCallback(
    (seat: number): CSSProperties => {
      // 自分視点での相対座席番号（0=自分/下, 1=左, 2=上, 3=右）
      const relative = (seat - selfSeat + 4) % 4;

      const fallback: Record<number, CSSProperties> = {
        0: { left: "50%", top: "78%", transform: "translate(-50%, -50%)" },
        1: { left: "8%", top: "48%", transform: "translate(-50%, -50%)" },
        2: { left: "50%", top: "14%", transform: "translate(-50%, -50%)" },
        3: { left: "92%", top: "48%", transform: "translate(-50%, -50%)" },
      };

      const offsets: Record<number, { x: number; y: number }> = {
        0: { x: 0, y: 0.64 },
        1: { x: -0.88, y: -0.08 },
        2: { x: 0, y: -0.76 },
        3: { x: 0.88, y: -0.08 },
      };

      const { width, height } = tableSize;
      const offset = offsets[relative];

      if (!offset) {
        return fallback[relative] ?? fallback[0];
      }

      if (width <= 0 || height <= 0) {
        return fallback[relative];
      }

      const translateX = (width / 2) * offset.x;
      const translateY = (height / 2) * offset.y;

      return {
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) translate(${translateX}px, ${translateY}px)`,
      };
    },
    [selfSeat, tableSize],
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

  // Effect animations: peek（相手手札の一時表示）
  const peekHint = state?.effectHints?.peek;
  const peekTarget = useMemo(
    () => (peekHint ? orderedPlayers.find((p) => p.id === peekHint.targetId) : undefined),
    [orderedPlayers, peekHint],
  );
  const [activePeekId, setActivePeekId] = useState<string | null>(null);
  useEffect(() => {
    if (!peekHint) return;
    if (activePeekId === peekHint.actionId) return;
    setActivePeekId(peekHint.actionId);
    const timer = window.setTimeout(() => {
      setActivePeekId((current) => (current === peekHint.actionId ? null : current));
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [peekHint, activePeekId]);

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
    <div className="relative flex min-h-[100dvh] flex-col overflow-y-auto">
      <AnimatePresence>{state && <TurnBanner state={state} isMyTurn={isMyTurn} />}</AnimatePresence>
      <LogPanel />
      <ResultDialog />
      <div className="fixed left-6 top-6 z-30">
        <SoundControls />
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pt-16 pb-32" role="region" aria-label="ゲームテーブル">
        <div className="flex flex-1 flex-col items-center gap-6">
          <div className="flex flex-1 items-center justify-center">
            <div
              ref={tableContainerRef}
              className="relative aspect-square w-full max-w-[28rem] sm:max-w-[32rem] lg:max-w-[38rem]"
              style={{ width: tableSize.width ? `${tableSize.width}px` : undefined, height: tableSize.height ? `${tableSize.height}px` : undefined }}
            >
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

              {/* peek overlay */}
              <AnimatePresence>
                {activePeekId && peekHint && peekTarget && (
                  <div className="absolute" style={getHudPlacementStyle(peekTarget.seat)}>
                    <div className="relative -mt-4">
                      <div className="pointer-events-none absolute -inset-6 rounded-2xl bg-[rgba(10,28,26,0.65)] blur-md" aria-hidden />
                      <div className="relative rounded-2xl border border-[rgba(215,178,110,0.45)] bg-gradient-to-br from-[rgba(28,68,63,0.96)] via-[rgba(22,52,47,0.96)] to-[rgba(14,32,29,0.98)] px-5 py-4 text-center shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
                        <div className="text-[var(--color-accent-light)]">
                          <p className="text-[10px] uppercase tracking-[0.35em] opacity-80">Peek</p>
                          <p className="mt-1 text-sm opacity-80">{peekTarget.nickname} の手札</p>
                          <p className="mt-2 font-heading text-4xl">{CARD_DEFINITIONS[peekHint.card]?.rank ?? "?"}</p>
                          <p className="mt-1 text-sm">{CARD_DEFINITIONS[peekHint.card]?.name ?? "Unknown"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </AnimatePresence>

              {/* simple effect cues for other actions */}
              {state?.lastAction && (() => {
                const a = state.lastAction;
                const actor = orderedPlayers.find((p) => p.id === a.actorId);
                const target = a.targetId ? orderedPlayers.find((p) => p.id === a.targetId) : undefined;
                const show = (label: string, seat: number) => (
                  <div className="absolute" style={getHudPlacementStyle(seat)}>
                    <div className="mt-2 rounded-full border border-[rgba(215,178,110,0.35)] bg-[rgba(12,32,30,0.8)] px-3 py-1 text-xs text-[var(--color-accent-light)] shadow-[0_10px_24px_rgba(0,0,0,0.45)]">
                      {label}
                    </div>
                  </div>
                );
                switch (a.type) {
                  case "compare":
                    return actor && target ? (
                      <>
                        {show("VS", actor.seat)}
                        {show("VS", target.seat)}
                      </>
                    ) : null;
                  case "force_discard":
                    return target ? show("Forced Discard", target.seat) : null;
                  case "swap_hands":
                    return actor && target ? (
                      <>
                        {show("Swap", actor.seat)}
                        {show("Swap", target.seat)}
                      </>
                    ) : null;
                  case "shield":
                    return actor ? show("Shielded", actor.seat) : null;
                  default:
                    return null;
                }
              })()}
              </div>
            </div>
          </div>

          <div className="mt-24 w-full max-w-3xl shrink-0 sm:mt-28">
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

