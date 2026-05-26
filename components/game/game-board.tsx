'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, LayoutGroup } from "framer-motion";
import { useGameEffects } from "@/components/game/game-effects-provider";

import { ActionBar } from "@/components/game/action-bar";
import { CardEffectLayer, type CardEffectEvent } from "@/components/game/card-effect-layer";
import { CARD_FX_PRESETS } from "@/components/game/card-fx-presets";
import { GameTable } from "@/components/game/game-table";
import { HandCard } from "@/components/game/hand-card";
import { HandRevealOverlay } from "@/components/game/hand-reveal-overlay";
import { LogPanel } from "@/components/game/log-panel";
import { PlayerHUD } from "@/components/game/player-hud";
import { ResultDialog } from "@/components/game/result-dialog";
import { TurnBanner } from "@/components/game/turn-banner";
import { WaitingRoomPanel } from "@/components/game/waiting-room-panel";
import { useGameContext } from "@/components/game/game-provider";
import { Badge } from "@/components/ui/badge";
import { TurnCutin } from "@/components/game/turn-cutin";
import { RoomIdDisplay } from "@/components/ui/room-id-display";
import { SoundControls } from "@/components/game/sound-controls";
import { CardReferenceDialog } from "@/components/game/card-reference-dialog";
import {
  ACTION_BAR_BOTTOM_DOCK_MAX_HEIGHT,
  ACTION_BAR_LEFT_DOCK_WIDTH_REM,
  FLOATING_PANEL_SIDE_OFFSET_REM,
  LOG_PANEL_BOTTOM_OFFSET_REM,
  LOG_PANEL_MIN_WIDTH_REM,
  OVERLAY_GAME_TABLE_MAX_WIDTH_REM,
  OVERLAY_INFO_RAIL_MAX_WIDTH_REM,
} from "@/components/game/layout-constants";
import { CARD_DEFINITIONS } from "@/lib/game/cards";
import { ErrorAlert } from "@/components/game/error-alert";
import type { CardEffectType, CardId, ClientGameState, PlayerId } from "@/lib/game/types";
import { cn } from "@/lib/utils";

const RELATIVE_OFFSETS: Record<number, { x: number; y: number }> = {
  0: { x: 0, y: 0.82 },
  1: { x: -1.08, y: 0.02 },
  2: { x: 0, y: -0.9 },
  3: { x: 1.2, y: 0.02 },
};

const EFFECT_POSITION_SCALE = 0.78;
const ACTION_BAR_DOCK_EVENT = "action_bar_dock_change";

type PlayerSnapshot = ClientGameState["players"][number] | NonNullable<ClientGameState["self"]>;
type ActionBarDock = "left" | "bottom";

export function GameBoard() {
  const {
    roomId,
    shortId,
    state,
    optimisticHand,
    selectedCard,
    setSelectedCard,
    selectedTarget,
    setSelectedTarget,
    guessedRank,
    setGuessedRank,
    isMyTurn,
    selfId,
    effectScale,
    turnCutinMs,
    roundCutinMs,
    roundToTurnCutinDelayMs,
    handRevealMs,
    playCard,
    cancelSelection,
    cardDefinition,
    requiresTarget,
    targetOptions,
    noAvailableTargets,
    error,
    refetch,
    reconnect,
    loading,
    clearError,
  } = useGameContext();

  // ターン開始検出用
  const [showTurnCutin, setShowTurnCutin] = useState(false);
  const [cutinText, setCutinText] = useState("あなたの番");
  const [cutinSequence, setCutinSequence] = useState(0);
  const [botTurnSince, setBotTurnSince] = useState<number | null>(null);
  const [forcingBot, setForcingBot] = useState(false);
  const [botActionError, setBotActionError] = useState<string | null>(null);
  const [showBotRecovery, setShowBotRecovery] = useState(false);
  const prevTurnRef = useRef<boolean>(false);
  const prevRoundRef = useRef<number | null>(null);
  const cutinInitializedRef = useRef(false);

  const triggerCutin = useCallback((nextText: string) => {
    setCutinText(nextText);
    setCutinSequence((prev) => prev + 1);
    setShowTurnCutin(true);
  }, []);

  const isActiveBotTurn = Boolean(
    state &&
      state.phase === "choose_card" &&
      state.activePlayerId &&
      state.players.some((p) => p.id === state.activePlayerId && p.isBot && !p.isEliminated),
  );
  useEffect(() => {
    if (!isActiveBotTurn) {
      setBotTurnSince(null);
      setBotActionError(null);
      return;
    }
    setBotTurnSince((prev) => prev ?? Date.now());
  }, [isActiveBotTurn, state?.activePlayerId, state?.turnIndex]);

  useEffect(() => {
    if (!isActiveBotTurn || !botTurnSince) {
      setShowBotRecovery(false);
      return;
    }
    const elapsed = Date.now() - botTurnSince;
    if (elapsed >= 3500) {
      setShowBotRecovery(true);
      return;
    }
    const timeoutId = window.setTimeout(() => setShowBotRecovery(true), Math.max(0, 3500 - elapsed));
    return () => window.clearTimeout(timeoutId);
  }, [botTurnSince, isActiveBotTurn]);

  const handleForceBotTurn = useCallback(async () => {
    if (!roomId || forcingBot) return;
    setForcingBot(true);
    setBotActionError(null);
    try {
      const res = await fetch("/api/game/bot-action", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(selfId ? { "X-Player-Id": selfId } : {}) },
        body: JSON.stringify({ roomId, skipThinkDelay: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.success === false) {
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      await refetch();
    } catch (error) {
      setBotActionError(error instanceof Error ? error.message : "Bot進行に失敗しました。");
    } finally {
      setForcingBot(false);
    }
  }, [forcingBot, refetch, roomId, selfId]);

  useEffect(() => {
    if (!state) return;

    // 初回表示時はカットインを出さず、前回値のみ初期化する
    if (!cutinInitializedRef.current) {
      cutinInitializedRef.current = true;
      prevTurnRef.current = isMyTurn;
      prevRoundRef.current = state.round;
      return;
    }

    let delayedTurnTimer: number | null = null;
    const roundChanged = prevRoundRef.current !== null && state.round !== prevRoundRef.current;

    if (roundChanged) {
      triggerCutin(`ラウンド ${state.round}`);

      // ラウンド開始直後かつ自分の入力フェーズに入っている場合のみ追従表示
      if (isMyTurn && state.phase === "choose_card") {
        delayedTurnTimer = window.setTimeout(() => {
          triggerCutin("あなたの番");
        }, roundToTurnCutinDelayMs);
      }
    } else if (isMyTurn && !prevTurnRef.current && state.phase === "choose_card") {
      triggerCutin("あなたの番");
    }

    prevTurnRef.current = isMyTurn;
    prevRoundRef.current = state.round;

    return () => {
      if (delayedTurnTimer) {
        window.clearTimeout(delayedTurnTimer);
      }
    };
  }, [isMyTurn, roundToTurnCutinDelayMs, state, triggerCutin]);

  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const fx = useGameEffects();
  const [tableSize, setTableSize] = useState({ width: 0, height: 0 });
  const [effectEvents, setEffectEvents] = useState<CardEffectEvent[]>([]);
  const prevStateRef = useRef<ClientGameState | null>(null);
  const processedActionIdsRef = useRef<Set<string>>(new Set());
  const [showHandReveal, setShowHandReveal] = useState(false);
  const [handRevealComplete, setHandRevealComplete] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [useOverlayInfoRail, setUseOverlayInfoRail] = useState(false);
  const [actionBarDock, setActionBarDock] = useState<ActionBarDock>("left");
  const hand = useMemo(
    () => optimisticHand ?? state?.hand ?? state?.self?.hand ?? [],
    [optimisticHand, state?.hand, state?.self?.hand],
  );
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const evaluateViewport = () => {
      const compact = window.innerHeight < 960 || window.innerWidth < 1024;
      setIsCompactViewport(compact);
      setUseOverlayInfoRail(window.innerWidth >= 1280 && !compact);
    };
    evaluateViewport();
    window.addEventListener("resize", evaluateViewport);
    return () => window.removeEventListener("resize", evaluateViewport);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncDockFromStorage = () => {
      const stored = window.localStorage.getItem("actionBarDock");
      setActionBarDock(stored === "bottom" ? "bottom" : "left");
    };

    const handleDockChange = (event: Event) => {
      const dock = (event as CustomEvent<{ dock?: ActionBarDock }>).detail?.dock;
      if (dock === "left" || dock === "bottom") {
        setActionBarDock(dock);
        return;
      }
      syncDockFromStorage();
    };

    syncDockFromStorage();
    window.addEventListener("storage", syncDockFromStorage);
    window.addEventListener(ACTION_BAR_DOCK_EVENT, handleDockChange as EventListener);
    return () => {
      window.removeEventListener("storage", syncDockFromStorage);
      window.removeEventListener(ACTION_BAR_DOCK_EVENT, handleDockChange as EventListener);
    };
  }, []);

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
      const styles = window.getComputedStyle(element);
      const maxWidth = parseFloat(styles.maxWidth) || 0;
      const parentRect = element.parentElement?.getBoundingClientRect();
      const viewportAvailable = Math.max(window.innerWidth - 96, 240);

      const candidates = [
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

            // エフェクト連動（ヒットストップ/シェイク/パーティクル）
            try {
              const rect = tableContainerRef.current?.getBoundingClientRect();
              const toViewport = (seat?: number) => {
                if (!rect || typeof seat !== "number") return null;
                const pos = getSeatPosition(seat);
                if (!pos.valid) return null;
                return { x: rect.left + pos.x, y: rect.top + pos.y };
              };

              const actorPt = toViewport(actor?.seat);
              const targetPt = toViewport(target?.seat);
              const midpoint = actorPt && targetPt ? { x: (actorPt.x + targetPt.x) / 2, y: (actorPt.y + targetPt.y) / 2 } : targetPt ?? actorPt ?? (rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight / 2 });

              (async () => {
                const preset = CARD_FX_PRESETS[playedCardId as keyof typeof CARD_FX_PRESETS];
                const durationScale = Math.min(1, Math.max(0.45, effectScale || 1));
                const scaleMs = (ms: number) => Math.max(0, Math.round(ms * durationScale));
                const scaleCount = (count: number) => Math.max(1, Math.round(count * durationScale));
                switch (resolvedEffectType) {
                  case "guess_eliminate": {
                    await fx.triggerHitstop({ holdMs: scaleMs(preset?.hitstop?.holdMs ?? 90), flash: preset?.hitstop?.flash ?? true });
                    void fx.triggerScreenShake({ intensity: preset?.shake?.intensity ?? 14, durationMs: scaleMs(180) });
                    if (targetPt) fx.emitParticles({ kind: preset?.particles?.kind ?? "spark", count: scaleCount(preset?.particles?.count ?? 22), hue: preset?.particles?.hue ?? 45, origin: targetPt });
                    break;
                  }
                  case "peek": {
                    void fx.triggerScreenShake({ intensity: preset?.shake?.intensity ?? 6, durationMs: scaleMs(140) });
                    if (targetPt) fx.emitParticles({ kind: preset?.particles?.kind ?? "spark", count: scaleCount(preset?.particles?.count ?? 14), hue: preset?.particles?.hue ?? 190, origin: targetPt });
                    break;
                  }
                  case "compare": {
                    await fx.triggerHitstop({ holdMs: scaleMs(preset?.hitstop?.holdMs ?? 80), flash: preset?.hitstop?.flash ?? true });
                    void fx.triggerScreenShake({ intensity: preset?.shake?.intensity ?? 12, durationMs: scaleMs(180) });
                    if (midpoint) fx.emitParticles({ kind: preset?.particles?.kind ?? "spark", count: scaleCount(preset?.particles?.count ?? 24), hue: preset?.particles?.hue ?? 35, origin: midpoint });
                    break;
                  }
                  case "shield": {
                    void fx.triggerScreenShake({ intensity: preset?.shake?.intensity ?? 8, durationMs: scaleMs(160) });
                    if (actorPt) fx.emitParticles({ kind: preset?.particles?.kind ?? "dust", count: scaleCount(preset?.particles?.count ?? 18), hue: preset?.particles?.hue ?? 160, origin: actorPt });
                    break;
                  }
                  case "force_discard": {
                    await fx.triggerHitstop({ holdMs: scaleMs(preset?.hitstop?.holdMs ?? 90), flash: preset?.hitstop?.flash ?? false });
                    void fx.triggerScreenShake({ intensity: preset?.shake?.intensity ?? 12, durationMs: scaleMs(180) });
                    if (targetPt) fx.emitParticles({ kind: preset?.particles?.kind ?? "spark", count: scaleCount(preset?.particles?.count ?? 20), hue: preset?.particles?.hue ?? 25, origin: targetPt });
                    break;
                  }
                  case "swap_hands": {
                    void fx.triggerScreenShake({ intensity: preset?.shake?.intensity ?? 10, durationMs: scaleMs(180) });
                    if (midpoint) fx.emitParticles({ kind: preset?.particles?.kind ?? "confetti", count: scaleCount(preset?.particles?.count ?? 26), hue: preset?.particles?.hue ?? 45, origin: midpoint });
                    break;
                  }
                  case "conditional_discard": {
                    void fx.triggerScreenShake({ intensity: preset?.shake?.intensity ?? 6, durationMs: scaleMs(140) });
                    if (actorPt) fx.emitParticles({ kind: preset?.particles?.kind ?? "dust", count: scaleCount(preset?.particles?.count ?? 14), hue: preset?.particles?.hue ?? 280, origin: actorPt });
                    break;
                  }
                  case "self_eliminate": {
                    await fx.triggerHitstop({ holdMs: scaleMs(preset?.hitstop?.holdMs ?? 110), flash: preset?.hitstop?.flash ?? true });
                    void fx.triggerScreenShake({ intensity: preset?.shake?.intensity ?? 16, durationMs: scaleMs(200) });
                    if (actorPt) fx.emitParticles({ kind: preset?.particles?.kind ?? "spark", count: scaleCount(preset?.particles?.count ?? 28), hue: preset?.particles?.hue ?? 5, origin: actorPt });
                    break;
                  }
                  default:
                    break;
                }
              })();
            } catch {}
          }
        }
      }
    }

    prevStateRef.current = state;
  }, [effectScale, fx, generateEventId, getSeatPosition, pushEffectEvent, resolveEffectType, state]);

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

      const activeElement = document.activeElement as HTMLElement | null;
      const isTypingField = Boolean(
        activeElement &&
          (activeElement.tagName === "INPUT" ||
            activeElement.tagName === "TEXTAREA" ||
            activeElement.tagName === "SELECT" ||
            activeElement.isContentEditable),
      );
      if (isTypingField && event.key !== "Escape") {
        return;
      }

      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        if (hand.length === 0) return;
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const currentIndex = selectedCard ? hand.findIndex((card) => card === selectedCard) : -1;
        const nextIndex = currentIndex === -1 ? (direction === 1 ? 0 : hand.length - 1) : (currentIndex + direction + hand.length) % hand.length;
        setSelectedCard(hand[nextIndex]);
        return;
      }

      if (requiresTarget && !noAvailableTargets && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        const selectableTargets = targetOptions.filter((option) => !option.disabled);
        if (selectableTargets.length === 0) return;
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const currentIndex = selectedTarget
          ? selectableTargets.findIndex((option) => option.id === selectedTarget)
          : -1;
        const nextIndex =
          currentIndex === -1
            ? direction === 1
              ? 0
              : selectableTargets.length - 1
            : (currentIndex + direction + selectableTargets.length) % selectableTargets.length;
        setSelectedTarget(selectableTargets[nextIndex].id);
        return;
      }

      const numericKey = Number.parseInt(event.key, 10);
      if (
        cardDefinition?.requiresGuess &&
        Number.isInteger(numericKey) &&
        numericKey >= 2 &&
        numericKey <= 8
      ) {
        event.preventDefault();
        if (guessedRank !== numericKey) {
          setGuessedRank(numericKey);
        }
        return;
      }

      if (cardDefinition?.requiresGuess && (event.key === "Backspace" || event.key === "Delete")) {
        event.preventDefault();
        setGuessedRank(null);
        return;
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
  }, [
    cancelSelection,
    cardDefinition?.requiresGuess,
    guessedRank,
    hand,
    isMyTurn,
    noAvailableTargets,
    playCard,
    requiresTarget,
    selectedCard,
    selectedTarget,
    setGuessedRank,
    setSelectedCard,
    setSelectedTarget,
    targetOptions,
  ]);

  const overlayLogPanelStyle = useMemo<CSSProperties>(
    () => ({
      minWidth: `${LOG_PANEL_MIN_WIDTH_REM}rem`,
      width: `min(${OVERLAY_INFO_RAIL_MAX_WIDTH_REM}rem, calc(100vw - 25rem))`,
      right:
        actionBarDock === "left"
          ? `calc(${ACTION_BAR_LEFT_DOCK_WIDTH_REM}rem + ${FLOATING_PANEL_SIDE_OFFSET_REM}rem)`
          : `${FLOATING_PANEL_SIDE_OFFSET_REM}rem`,
      bottom:
        actionBarDock === "bottom"
          ? `calc(${ACTION_BAR_BOTTOM_DOCK_MAX_HEIGHT} + ${LOG_PANEL_BOTTOM_OFFSET_REM}rem)`
          : `${LOG_PANEL_BOTTOM_OFFSET_REM}rem`,
    }),
    [actionBarDock],
  );

  const overlayInfoRailStyle = useMemo<CSSProperties>(
    () => ({ maxWidth: `${OVERLAY_INFO_RAIL_MAX_WIDTH_REM}rem` }),
    [],
  );

  const tableContainerStyle = useMemo<CSSProperties>(
    () => ({
      maxWidth: useOverlayInfoRail ? `${OVERLAY_GAME_TABLE_MAX_WIDTH_REM}rem` : undefined,
      width: tableSize.width ? `${tableSize.width}px` : undefined,
      height: tableSize.height ? `${tableSize.height}px` : undefined,
    }),
    [tableSize.height, tableSize.width, useOverlayInfoRail],
  );

  // 待機中（ゲーム未開始）の場合は待機画面を表示
  if (!state && !loading) {
    return (
      <>
        <AnimatePresence>
          {error && (
            <ErrorAlert
              error={error}
              loading={loading}
              onRetry={() => {
                refetch().catch(() => {});
              }}
              onReload={() => window.location.reload()}
              onDismiss={clearError}
            />
          )}
        </AnimatePresence>
        <WaitingRoomPanel roomId={roomId} />
      </>
    );
  }

  const rootClasses = cn(
    "relative flex h-screen flex-col",
    isCompactViewport ? "overflow-y-auto" : "overflow-hidden",
  );

  const contentClasses = cn(
    "mx-auto flex w-full max-w-6xl flex-1 flex-col",
    useOverlayInfoRail
      ? isCompactViewport
        ? "px-4 pt-10 pb-32"
        : "px-6 pt-14 pb-20"
      : isCompactViewport
        ? "px-4 pt-6 pb-32"
        : "px-5 pt-8 pb-24",
  );

  const gameStatusLabel = state?.result
    ? "ゲーム終了"
    : state?.phase === "choose_card" && isMyTurn
      ? "あなたの手番"
      : state?.phase === "choose_card"
        ? "相手の手番"
        : state
          ? "進行中"
          : "開始待ち";
  const progressScore = `${state?.self?.discardPile.length ?? 0} / ${Math.max(1, state?.round ?? 1)}`;
  const latestLog = state?.logs?.[state.logs.length - 1];
  const nextActionHint = state?.result
    ? "結果を確認して、再戦ボタンから次のゲームを始めましょう。"
    : isMyTurn
      ? "手札から使うカードを1枚選び、対象が必要な場合は相手を選択してください。"
      : "相手の行動を待機中です。ログを確認して次の一手を考えましょう。";

  return (
    <div className={rootClasses} data-testid="game-board">
      <TurnCutin
        show={showTurnCutin}
        text={cutinText}
        triggerKey={cutinSequence}
        turnCutinMs={turnCutinMs}
        roundCutinMs={roundCutinMs}
      />

      {useOverlayInfoRail && (
        <>
          <div
            className="pointer-events-none fixed left-3 top-16 z-30 flex w-[calc(100vw-2.5rem)] flex-col gap-4 sm:left-6 sm:top-20 lg:left-10"
            style={overlayInfoRailStyle}
          >
            <AnimatePresence>{state && <TurnBanner state={state} isMyTurn={isMyTurn} />}</AnimatePresence>
          </div>
          <div
            className="pointer-events-none fixed z-30 max-w-[calc(100vw-1rem)]"
            style={overlayLogPanelStyle}
          >
            <LogPanel />
          </div>
        </>
      )}

      {useOverlayInfoRail && !isBotGame && (
        <div className="pointer-events-auto fixed left-3 top-4 z-30 flex items-center gap-3 sm:left-6 sm:top-6 lg:left-10">
          <RoomIdDisplay roomId={shortId ?? roomId} variant="compact" />
          <div className="flex gap-1.5">
            <SoundControls />
            <CardReferenceDialog />
          </div>
        </div>
      )}
      {useOverlayInfoRail && isBotGame && (
        <div className="pointer-events-auto fixed left-3 top-4 z-30 flex gap-1.5 sm:left-6 sm:top-6 lg:left-10">
          <SoundControls />
          <CardReferenceDialog />
        </div>
      )}

      <AnimatePresence>
        {error && (
          <ErrorAlert
            error={error}
            loading={loading}
            onRetry={() => {
              reconnect().catch(() => {});
            }}
            onReload={() => window.location.reload()}
            onDismiss={clearError}
          />
        )}
      </AnimatePresence>

      <ResultDialog />

      <div className={contentClasses}>
        <div className="flex flex-1 flex-col items-center gap-6">
          <section
            data-testid="game-header"
            className="w-full max-w-3xl rounded-xl border border-[rgba(215,178,110,0.25)] bg-[rgba(12,32,30,0.78)] p-3 shadow-[0_10px_28px_rgba(0,0,0,0.28)]"
          >
            <p className="text-xs tracking-[0.3em] text-[var(--color-text-muted)]">LOVE LETTER REVERIE</p>
            <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
              <p data-testid="game-status"><span className="font-semibold">状態:</span> {gameStatusLabel}</p>
              <p data-testid="game-score"><span className="font-semibold">進捗:</span> {progressScore}</p>
              <p><span className="font-semibold">ラウンド:</span> {state?.round ?? "-"}</p>
            </div>
          </section>

          <section
            data-testid="game-rule-panel"
            className="w-full max-w-3xl rounded-xl border border-[rgba(215,178,110,0.2)] bg-[rgba(9,20,19,0.85)] p-3 text-sm"
          >
            <p className="font-semibold">目的: 最後まで生き残るか、山札切れ時に最強ランクを保持して勝利する。</p>
            <p className="mt-1 text-[var(--color-text-muted)]">操作: 自分の手番で手札を1枚選んで使用。対象・推測が必要なカードは追加選択後に確定。</p>
          </section>

          {!useOverlayInfoRail && (
            <div className="w-full max-w-3xl space-y-3">
              <div className="flex items-center gap-2 rounded-xl border border-[rgba(215,178,110,0.25)] bg-[rgba(12,32,30,0.78)] px-3 py-2 shadow-[0_10px_28px_rgba(0,0,0,0.28)]">
                {!isBotGame && <RoomIdDisplay roomId={shortId ?? roomId} variant="compact" />}
                <div className="ml-auto flex gap-1.5">
                  <SoundControls />
                  <CardReferenceDialog />
                </div>
              </div>
              <AnimatePresence>{state && <TurnBanner state={state} isMyTurn={isMyTurn} />}</AnimatePresence>
              <LogPanel />
            </div>
          )}

          <div className="flex w-full flex-1 items-center justify-center">
            <div
              ref={tableContainerRef}
              data-testid="game-table"
              className="relative aspect-square w-full max-w-[24rem] sm:max-w-[30rem] lg:max-w-[38rem]"
              style={tableContainerStyle}
              role="region"
              aria-label="ゲームテーブル"
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
                  durationScale={effectScale}
                  onEventComplete={handleEventComplete}
                />
                {showHandReveal && state?.result?.finalHands && (
                  <HandRevealOverlay
                    finalHands={state.result.finalHands}
                    players={orderedPlayers}
                    tableSize={tableSize}
                    getSeatPosition={getSeatPosition}
                    displayDurationMs={handRevealMs}
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

          <div className="w-full max-w-3xl">
            <section
              data-testid="game-action-feedback"
              className="mb-3 rounded-xl border border-[rgba(215,178,110,0.2)] bg-[rgba(9,20,19,0.8)] p-3 text-sm"
            >
              <p className="font-semibold">直前の結果: {latestLog?.message ?? "まだ行動ログはありません。"}</p>
              <p className="mt-1 text-[var(--color-text-muted)]">次の行動: {nextActionHint}</p>
            </section>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Badge variant="outline">あなた</Badge>
              <span data-testid="self-player-label" className="font-heading text-xl text-[var(--color-accent-light)]">
                {state?.self?.nickname ?? "観戦モード"}
              </span>
              {!isMyTurn && state?.self && !state.self.isEliminated && (
                <span className="text-xs text-[var(--color-text-muted)]">ターン待機中...</span>
              )}
              {isActiveBotTurn && <span className="text-xs text-[var(--color-text-muted)]">Botが考えています...</span>}
            </div>
            {showBotRecovery && (
              <div className="mt-2 flex flex-col items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <p>Botの手番です。しばらく進まない場合は「Botの手番を進める」を押してください。</p>
                <button className="rounded border px-3 py-1 text-white disabled:opacity-50" onClick={() => void handleForceBotTurn()} disabled={forcingBot}>
                  {forcingBot ? "進行中..." : "Botの手番を進める"}
                </button>
                {botActionError && <p className="text-red-300">{botActionError}</p>}
              </div>
            )}
            <div data-testid="player-hand" className="mt-3 flex min-h-[5.5rem] flex-wrap justify-center gap-4">
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
                <p data-testid="hand-empty-message" className="text-sm text-[var(--color-text-muted)]">現在手札は表示されていません。</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {state?.self && !state.self.isEliminated && <ActionBar />}
    </div>
  );
}
