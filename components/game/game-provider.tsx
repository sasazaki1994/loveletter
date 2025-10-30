'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { CARD_DEFINITIONS } from "@/lib/game/cards";
import type { CardDefinition, CardId, ClientGameState, PlayerId } from "@/lib/game/types";
import { useGamePolling } from "@/lib/hooks/use-game-polling";
import { useSoundEffects, type SoundKey } from "@/lib/hooks/use-sound-effects";

interface GameProviderProps {
  roomId: string;
  playerId?: string;
  children: React.ReactNode;
}

export interface TargetOption {
  id: PlayerId;
  label: string;
  disabled: boolean;
  badges: string[];
  reason?: string;
}

interface GameContextValue {
  state: ClientGameState | null;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
  selectedCard: CardId | null;
  setSelectedCard: React.Dispatch<React.SetStateAction<CardId | null>>;
  selectedTarget: PlayerId | null;
  setSelectedTarget: React.Dispatch<React.SetStateAction<PlayerId | null>>;
  guessedRank: number | null;
  setGuessedRank: (rank: number | null) => void;
  playCard: () => Promise<void>;
  cancelSelection: () => void;
  acting: boolean;
  isMyTurn: boolean;
  refetch: () => Promise<void>;
  selfId?: string;
  playSound: (key: SoundKey) => void;
  muted: boolean;
  toggleMute: () => void;
  volume: number;
  setVolume: (value: number) => void;
  cardDefinition?: CardDefinition;
  requiresTarget: boolean;
  targetOptions: TargetOption[];
  noAvailableTargets: boolean;
  actionError: string | null;
  clearActionError: () => void;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

export function GameProvider({ roomId, playerId, children }: GameProviderProps) {
  const { state, loading, error, refetch, lastUpdated } = useGamePolling({
    roomId,
    playerId,
  });
  const [selectedCard, setSelectedCard] = useState<CardId | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<PlayerId | null>(null);
  const [guessedRank, setGuessedRank] = useState<number | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const clearActionError = useCallback(() => setActionError(null), []);

  const prevStateRef = useRef<ClientGameState | null>(null);

  const { play: playSound, muted, toggleMute, volume, setVolume } = useSoundEffects(0.4);

  const selfId = state?.self?.id ?? playerId;
  const isMyTurn = Boolean(selfId && state?.activePlayerId === selfId && state.phase === "choose_card");

  const cardDefinition = selectedCard ? CARD_DEFINITIONS[selectedCard] : undefined;
  const requiresTarget = Boolean(
    cardDefinition && (cardDefinition.target === "opponent" || cardDefinition.target === "any"),
  );

  const targetOptions = useMemo(() => {
    if (!state || !cardDefinition) return [] as TargetOption[];

    const options: TargetOption[] = [];

    const pushOption = (
      player: ClientGameState["players"][number] | ClientGameState["self"],
      labelSuffix?: string,
    ) => {
      if (!player) return;
      const badges: string[] = [];
      let reason: string | undefined;

      if (player.isEliminated) {
        badges.push("脱落");
        reason = "脱落したプレイヤーは対象にできません";
      }
      if (player.shield) {
        badges.push("防御中");
        if (cardDefinition.cannotTargetShielded) {
          reason = "守護状態のため対象不可";
        }
      }

      const disabled =
        player.isEliminated || (cardDefinition.cannotTargetShielded ? player.shield : false);

      options.push({
        id: player.id,
        label: labelSuffix ? `${player.nickname} ${labelSuffix}` : player.nickname,
        disabled,
        badges,
        reason,
      });
    };

    if (cardDefinition.target === "self") {
      if (state.self) pushOption(state.self, "(自分)");
      return options;
    }

    if (cardDefinition.target === "any" && state.self) {
      pushOption(state.self, "(自分)");
    }

    for (const player of state.players) {
      if (state.self && player.id === state.self.id) continue;
      pushOption(player);
    }

    return options;
  }, [cardDefinition, state]);

  const noAvailableTargets = requiresTarget &&
    targetOptions.every((option) => option.disabled);

  useEffect(() => {
    const prev = prevStateRef.current;
    if (state && prev) {
      if (prev.activePlayerId !== state.activePlayerId && state.activePlayerId === selfId) {
        playSound("turn_chime");
      }
      if (prev.logs.length < state.logs.length) {
        const latest = state.logs[state.logs.length - 1];
        if (latest?.icon) {
          if (latest.icon === "shield") playSound("shield");
          else if (latest.icon === "mask" || latest.icon === "swords") playSound("confirm");
          else if (latest.icon === "flame") playSound("deny");
          else if (latest.icon === "crown")
            playSound(prev.self?.id === selfId ? "win" : "confirm");
          else playSound("card_place");
        } else {
          playSound("card_place");
        }
      }

      const prevHandCount = prev.self?.hand?.length ?? prev.hand?.length ?? 0;
      const nextHandCount = state.self?.hand?.length ?? state.hand?.length ?? 0;
      if (nextHandCount > prevHandCount && state.activePlayerId === selfId) {
        playSound("card_draw");
      }

      const wasEliminated = prev.self?.isEliminated ?? false;
      const nowEliminated = state.self?.isEliminated ?? false;
      if (!wasEliminated && nowEliminated) {
        playSound("lose");
      }
    }
    if (state) {
      prevStateRef.current = state;
    }
  }, [playSound, selfId, state]);

  useEffect(() => {
    if (!isMyTurn) {
      setSelectedCard(null);
      setSelectedTarget(null);
      setGuessedRank(null);
    }
  }, [isMyTurn, state?.activePlayerId, state?.phase]);

  useEffect(() => {
    setGuessedRank(null);
    if (!cardDefinition) {
      setSelectedTarget(null);
      return;
    }

    if (cardDefinition.target === "self" && state?.self) {
      setSelectedTarget(state.self.id);
      return;
    }

    if (!requiresTarget) {
      setSelectedTarget(null);
      return;
    }

    setSelectedTarget((prev) => {
      if (!prev) return null;
      const stillValid = targetOptions.some((option) => option.id === prev && !option.disabled);
      return stillValid ? prev : null;
    });
  }, [cardDefinition, requiresTarget, setGuessedRank, setSelectedTarget, state?.self, targetOptions]);

  const cancelSelection = useCallback(() => {
    setSelectedCard(null);
    setSelectedTarget(null);
    setGuessedRank(null);
    setActionError(null);
  }, []);

  const playCard = useCallback(async () => {
    if (!selectedCard || !selfId || !state || acting) return;
    const definition = CARD_DEFINITIONS[selectedCard];
    if (!definition) return;

    const requiresTargetSelection = definition.target === "opponent" || definition.target === "any";
    if (definition.requiresGuess && (!guessedRank || guessedRank === 1) && !noAvailableTargets) {
      return;
    }
    if (requiresTargetSelection && !noAvailableTargets && !selectedTarget) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 3500);

    try {
      setActing(true);
      setActionError(null);
      const response = await fetch("/api/game/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          gameId: state.id,
          roomId: state.roomId,
          playerId: selfId,
          type: "play_card",
          payload: {
            cardId: selectedCard,
            targetId: selectedTarget ?? undefined,
            guessedRank: guessedRank ?? undefined,
          },
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
      };

      if (!response.ok || payload.success === false) {
        throw new Error(payload.message ?? "アクションに失敗しました");
      }

      playSound("card_place");
      cancelSelection();
      await refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "アクションに失敗しました";
      if (error instanceof DOMException && error.name === "AbortError") {
        setActionError("カード送信がタイムアウトしました。通信状況をご確認ください。");
      } else {
        setActionError(message);
      }
      console.error(error);
      playSound("deny");
    } finally {
      clearTimeout(timeoutId);
      setActing(false);
    }
  }, [acting, cancelSelection, guessedRank, noAvailableTargets, playSound, refetch, selectedCard, selectedTarget, selfId, state]);

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      loading,
      error,
      lastUpdated,
      selectedCard,
      setSelectedCard,
      selectedTarget,
      setSelectedTarget,
      guessedRank,
      setGuessedRank,
      playCard,
      cancelSelection,
      acting,
      isMyTurn,
      refetch,
      selfId,
      playSound,
      muted,
      toggleMute,
      volume,
      setVolume,
      cardDefinition,
      requiresTarget,
      targetOptions,
      noAvailableTargets,
      actionError,
      clearActionError,
    }),
    [
      acting,
      cancelSelection,
      error,
      guessedRank,
      isMyTurn,
      lastUpdated,
      loading,
      muted,
      playCard,
      playSound,
      refetch,
      selectedCard,
      selectedTarget,
      selfId,
      setVolume,
      state,
      toggleMute,
      volume,
      cardDefinition,
      requiresTarget,
      targetOptions,
      noAvailableTargets,
      actionError,
      clearActionError,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGameContext(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGameContext must be used within GameProvider");
  }
  return context;
}

