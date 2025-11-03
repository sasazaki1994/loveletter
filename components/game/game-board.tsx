'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";

import { ActionBar } from "@/components/game/action-bar";
import { CardEffectLayer, type CardEffectEvent } from "@/components/game/card-effect-layer";
import { GameTable } from "@/components/game/game-table";
import { HandCard } from "@/components/game/hand-card";
import { HandRevealOverlay } from "@/components/game/hand-reveal-overlay";
import { LogPanel } from "@/components/game/log-panel";
import { PlayerHUD } from "@/components/game/player-hud";
import { ResultDialog } from "@/components/game/result-dialog";
import { TurnBanner } from "@/components/game/turn-banner";
import { useGameContext } from "@/components/game/game-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoomIdDisplay } from "@/components/ui/room-id-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CARD_DEFINITIONS } from "@/lib/game/cards";
import type { CardEffectType, CardId, ClientGameState, PlayerId } from "@/lib/game/types";
import { AlertCircle, Loader2, RefreshCw, Users, X } from "lucide-react";

const RELATIVE_OFFSETS: Record<number, { x: number; y: number }> = {
  0: { x: 0, y: 0.82 },
  1: { x: -1.08, y: 0.02 },
  2: { x: 0, y: -0.9 },
  3: { x: 1.2, y: 0.02 },
};

const EFFECT_POSITION_SCALE = 0.78;

type PlayerSnapshot = ClientGameState["players"][number] | NonNullable<ClientGameState["self"]>;

export function GameBoard() {
  const {
    roomId,
    shortId,
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
    error,
    refetch,
    loading,
  } = useGameContext();

  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const [tableSize, setTableSize] = useState({ width: 0, height: 0 });
  const [effectEvents, setEffectEvents] = useState<CardEffectEvent[]>([]);
  const prevStateRef = useRef<ClientGameState | null>(null);
  const processedActionIdsRef = useRef<Set<string>>(new Set());
  const [showHandReveal, setShowHandReveal] = useState(false);
  const [handRevealComplete, setHandRevealComplete] = useState(false);
  const hand = useMemo(() => state?.hand ?? state?.self?.hand ?? [], [state?.hand, state?.self?.hand]);
  const orderedPlayers = useMemo(() => {
    if (!state) return [];
    return state.players.slice().sort((a, b) => a.seat - b.seat);
  }, [state]);

  const isBotGame = useMemo(() => {
    return Boolean(state?.players?.some((p) => p.isBot));
  }, [state?.players]);

  const selfSeat = useMemo(() => {
    if (!state) return 0;
    const me = state.players.find((p) => p.id === selfId);
    return me?.seat ?? 0;
  }, [state, selfId]);

  const generateEventId = useCallback(() => {
    const globalCrypto = typeof window !== "undefined" ? window.crypto : undefined;
    if (globalCrypto?.randomUUID) {
      return globalCrypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }, []);

  const pushEffectEvent = useCallback((event: CardEffectEvent) => {
    setEffectEvents((prev) => [...prev.slice(-5), event]);
  }, []);

  const handleEventComplete = useCallback((eventId: string) => {
    setEffectEvents((prev) => prev.filter((event) => event.id !== eventId));
  }, []);

  const resolveEffectType = useCallback((baseType: CardEffectType, lastActionType?: string) => {
    if (!lastActionType) return baseType;
    switch (lastActionType) {
      case "guess":
        return "guess_eliminate";
      case "peek":
        return "peek";
      case "compare":
        return "compare";
      default:
        return baseType;
    }
  }, []);

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
        0: { left: "50%", top: "86%", transform: "translate(-50%, -50%)" },
        1: { left: "6%", top: "50%", transform: "translate(-50%, -50%)" },
        2: { left: "50%", top: "10%", transform: "translate(-50%, -50%)" },
        3: { left: "96%", top: "50%", transform: "translate(-50%, -50%)" },
      };

      const { width, height } = tableSize;
      const offset = RELATIVE_OFFSETS[relative];

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

  const getSeatPosition = useCallback(
    (seat: number) => {
      const relative = (seat - selfSeat + 4) % 4;
      const offset = RELATIVE_OFFSETS[relative];
      const { width, height } = tableSize;

      if (!offset || width <= 0 || height <= 0) {
        return {
          x: width / 2,
          y: height / 2,
          valid: false,
        };
      }

      const centerX = width / 2;
      const centerY = height / 2;

      return {
        x: centerX + (width / 2) * offset.x * EFFECT_POSITION_SCALE,
        y: centerY + (height / 2) * offset.y * EFFECT_POSITION_SCALE,
        valid: true,
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

  useEffect(() => {
    if (!state) {
      setEffectEvents([]);
      prevStateRef.current = null;
      return;
    }

    const prev = prevStateRef.current;

    const buildLookup = (snapshot: ClientGameState | null) => {
      const map = new Map<PlayerId, PlayerSnapshot>();
      if (!snapshot) return map;
      snapshot.players.forEach((player) => {
        map.set(player.id, player);
      });
      if (snapshot.self) {
        map.set(snapshot.self.id, snapshot.self);
      }
      return map;
    };

    const playerLookup = buildLookup(state);

    const computeEliminated = (snapshot: ClientGameState | null) => {
      const eliminated = new Set<PlayerId>();
      if (!snapshot) return eliminated;
      snapshot.players.forEach((player) => {
        if (player.isEliminated) eliminated.add(player.id);
      });
      if (snapshot.self?.isEliminated) {
        eliminated.add(snapshot.self.id);
      }
      return eliminated;
    };

    const computeShielded = (snapshot: ClientGameState | null) => {
      const shielded = new Set<PlayerId>();
      if (!snapshot) return shielded;
      snapshot.players.forEach((player) => {
        if (player.shield) shielded.add(player.id);
      });
      if (snapshot.self?.shield) {
        shielded.add(snapshot.self.id);
      }
      return shielded;
    };

    const prevEliminated = computeEliminated(prev);
    const currentEliminated = computeEliminated(state);
    const newlyEliminated = [...currentEliminated].filter((id) => !prevEliminated.has(id));

    const prevShielded = computeShielded(prev);
    const currentShielded = computeShielded(state);
    const newlyShielded = [...currentShielded].filter((id) => !prevShielded.has(id));

    if (prev) {
      const prevDiscardLength = prev.discardPile.length;
      const currentDiscardLength = state.discardPile.length;

      if (currentDiscardLength > prevDiscardLength) {
        // 同一アクションの重複演出を抑止（lastAction.id 去重）
        const lastActionId = state.lastAction?.id;
        if (lastActionId) {
          const seen = processedActionIdsRef.current;
          if (seen.has(lastActionId)) {
            prevStateRef.current = state;
            return;
          }
          // 直近50件まで保持
          if (seen.size > 50) {
            const first = seen.values().next().value as string | undefined;
            if (first) seen.delete(first);
          }
          seen.add(lastActionId);
        }
        const newCards = state.discardPile.slice(prevDiscardLength) as CardId[];
        const playedCardId = newCards[0];
        if (playedCardId) {
          const definition = CARD_DEFINITIONS[playedCardId];
          if (definition) {
            let actorId: PlayerId | undefined = state.lastAction?.actorId ?? undefined;

            for (const player of state.players) {
              const previousPlayer = prev.players.find((p) => p.id === player.id);
              const previousCount = previousPlayer?.discardPile.length ?? 0;
              if (player.discardPile.length > previousCount) {
                actorId = player.id;
                break;
              }
            }

            if (!actorId && state.self && prev.self) {
              if (state.self.discardPile.length > prev.self.discardPile.length) {
                actorId = state.self.id;
              }
            }

            const actor = actorId ? playerLookup.get(actorId) : undefined;
            const targetId = state.lastAction?.targetId;
            const target = targetId ? playerLookup.get(targetId) : undefined;

            const resolvedEffectType = resolveEffectType(
              definition.effectType,
              state.lastAction?.type,
            );

            const eliminatedSeats = newlyEliminated
              .map((id) => {
                const participant = playerLookup.get(id);
                return participant?.seat;
              })
              .filter((seat): seat is number => typeof seat === "number");

            const event: CardEffectEvent = {
              id: generateEventId(),
              cardId: playedCardId,
              effectType: resolvedEffectType,
              actorId: actor?.id,
              actorSeat: actor?.seat,
              actorNickname: actor?.nickname,
              targetId: target?.id,
              targetSeat: target?.seat,
              targetNickname: target?.nickname,
              eliminatedPlayerIds: newlyEliminated,
              eliminatedSeats,
              createdAt: Date.now(),
            };

            const metadata: NonNullable<CardEffectEvent["metadata"]> = {};

            if (resolvedEffectType === "guess_eliminate" && target?.id) {
              metadata.guess = { success: newlyEliminated.includes(target.id) };
            }

            if (resolvedEffectType === "peek" && state.effectHints?.peek) {
              const hint = state.effectHints.peek;
              metadata.peek = {
                revealedCardId: hint.card,
                targetNickname: playerLookup.get(hint.targetId)?.nickname ?? target?.nickname,
              };
            }

            if (resolvedEffectType === "force_discard" && newCards.length > 1) {
              metadata.forcedDiscard = {
                discardedCardIds: newCards.slice(1) as CardId[],
              };
            }

            if (resolvedEffectType === "shield" && actor?.id && newlyShielded.includes(actor.id)) {
              metadata.shielded = { playerIds: newlyShielded };
            }

            if (Object.keys(metadata).length > 0) {
              event.metadata = metadata;
            }

            pushEffectEvent(event);
          }
        }
      }
    }

    prevStateRef.current = state;
  }, [generateEventId, pushEffectEvent, resolveEffectType, state]);

  // deck_exhausted時の手札公開を検出
  useEffect(() => {
    if (!state) return;
    
    if (state.result?.reason === "deck_exhausted" && state.result.finalHands && !handRevealComplete) {
      setShowHandReveal(true);
    } else {
      setShowHandReveal(false);
    }
  }, [state, handRevealComplete]);

  const handleHandRevealComplete = useCallback(() => {
    setShowHandReveal(false);
    setHandRevealComplete(true);
    try {
      // 手札公開の完了を全体に通知（ResultDialogが正確なタイミングで開くため）
      window.dispatchEvent(
        new CustomEvent("hand_reveal_complete", {
          detail: { gameId: state?.id },
        }),
      );
    } catch {
      // no-op (SSRやwindow未定義の保護)
    }
  }, [state?.id]);

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

  // 待機中（ゲーム未開始）の場合は待機画面を表示
  if (!state && !loading) {
    return (
      <div className="relative flex min-h-[100dvh] flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-12">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Users className="h-6 w-6 text-[var(--color-accent-light)]" />
                ルーム待機中
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-[var(--color-text-muted)]">
                他のプレイヤーの参加を待っています。ホストがゲームを開始すると、自動的に開始されます。
              </p>
              {!isBotGame && <RoomIdDisplay roomId={shortId ?? roomId} />}
              {loading && (
                <div className="flex items-center justify-center gap-2 text-sm text-[var(--color-text-muted)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  状態を確認中...
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-y-auto">
      <div className="pointer-events-none fixed right-4 top-6 z-30 flex w-[calc(100vw-2.5rem)] max-w-sm flex-col gap-4 sm:right-6">
        <AnimatePresence>{state && <TurnBanner state={state} isMyTurn={isMyTurn} />}</AnimatePresence>
        <LogPanel />
      </div>
      
      {/* ルームID表示（ボット戦では非表示） */}
      {!isBotGame && (
        <div className="pointer-events-auto fixed left-4 top-6 z-30 sm:left-6">
          <RoomIdDisplay roomId={shortId ?? roomId} variant="compact" />
        </div>
      )}
      
      {/* エラー通知バナー */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="pointer-events-auto fixed left-1/2 top-4 z-40 w-full max-w-md -translate-x-1/2"
            role="alert"
            aria-live="assertive"
          >
            <div className="mx-4 flex items-start gap-3 rounded-xl border border-[rgba(215,120,110,0.4)] bg-[rgba(60,20,18,0.85)] px-4 py-3 shadow-lg backdrop-blur-sm">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-warn-light)]" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium text-[var(--color-warn-light)]">{error}</p>
                {error.includes("接続が回復") && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        refetch().catch(() => {});
                      }}
                      disabled={loading}
                      className="h-7 text-xs"
                    >
                      <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                      再試行
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => window.location.reload()}
                      className="h-7 text-xs"
                    >
                      ページを再読み込み
                    </Button>
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                onClick={() => {}}
                className="h-7 w-7 shrink-0 p-0 text-[var(--color-warn-light)] hover:bg-[rgba(215,120,110,0.15)]"
                aria-label="エラーを閉じる"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ResultDialog />

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
                <CardEffectLayer
                  events={effectEvents}
                  tableSize={tableSize}
                  getSeatPosition={getSeatPosition}
                  onEventComplete={handleEventComplete}
                />
                {showHandReveal && state?.result?.finalHands && (
                  <HandRevealOverlay
                    finalHands={state.result.finalHands}
                    players={orderedPlayers}
                    tableSize={tableSize}
                    getSeatPosition={getSeatPosition}
                    onComplete={handleHandRevealComplete}
                  />
                )}
                {orderedPlayers.map((player) => (
                  <div key={player.id} className="absolute pointer-events-auto z-10" style={getHudPlacementStyle(player.seat)}>
                    <PlayerHUD
                      player={player}
                      isSelf={player.id === selfId}
                      isActive={state?.activePlayerId === player.id}
                      selectable={player.id !== selfId && isMyTurn && requiresTarget}
                      selected={selectedTarget === player.id}
                      disabled={targetOptionMap.get(player.id)?.disabled}
                      targetReason={targetOptionMap.get(player.id)?.reason}
                      onSelectTarget={handleSelectTarget}
                    />
                  </div>
                ))}
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

