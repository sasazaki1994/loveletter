import { and, desc, eq } from "drizzle-orm";

import type { GameActionRequest, GameActionResult, CardId, PlayerId } from "@/lib/game/types";
import { CARD_DEFINITIONS } from "@/lib/game/cards";
import { getForcedPlayableCard } from "@/lib/game/forced-card-rules";
import { resolveCardEffect, type RulesPlayerSnapshot } from "@/lib/game/rules/card-effect-engine";
import { db } from "@/lib/db/client";
import { actions, games, hands, logs, players } from "@/drizzle/schema";
import { getHand, resolveForceDiscard, swapHands, type DeckState } from "@/lib/server/game/hand-service";
import { advanceTurn } from "@/lib/server/game/turn-service";
import { concludeRound, determineWinnersByHand, eliminatePlayers } from "@/lib/server/game/round-service";
import { invalidateStateCache } from "@/lib/server/game-state-cache";
import { executeBotTurn } from "@/lib/server/game/bot-turn-service";

type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type TxResult = { success: boolean; message?: string; runBotAfterCommit?: boolean };

function validateGameCanAcceptAction(game: typeof games.$inferSelect | undefined, action: GameActionRequest): GameActionResult | null {
  if (!game) return { success: false, message: "ゲームが存在しません。" };
  if (game.phase !== "choose_card") return { success: false, message: "カードを使用できるフェーズではありません。" };
  if (game.activePlayerId !== action.playerId) return { success: false, message: "あなたの手番ではありません。" };
  return null;
}

function validateForcedCard(hand: CardId[], cardId: CardId): GameActionResult | null {
  const forcedCard = getForcedPlayableCard(hand);
  if (forcedCard && cardId !== forcedCard) {
    const message = forcedCard === "vizier" ? "Vizier を同時に所持しているため、このカードは使用できません。Vizier を捨ててください。" : "手札合計が12以上のため、Marquise を先に使用する必要があります。";
    return { success: false, message };
  }
  return null;
}

async function validateCardInHandOrIdempotent(tx: TxClient, gameId: string, playerId: string, currentHand: CardId[], cardId: CardId, targetId?: string, guessedRank?: number): Promise<GameActionResult | null> {
  const cardIndex = currentHand.findIndex((c) => c === cardId);
  if (cardIndex >= 0) return null;

  const [lastAction] = await tx.select().from(actions).where(eq(actions.gameId, gameId)).orderBy(desc(actions.createdAt)).limit(1);
  const lastPayload = (lastAction?.payload ?? {}) as { cardId?: CardId; targetId?: string | null; guessedRank?: number | null };
  const same = lastAction?.actorId === playerId && lastAction?.type === "play_card" && lastPayload.cardId === cardId && (lastPayload.targetId ?? undefined) === (targetId ?? undefined) && (lastPayload.guessedRank ?? undefined) === (guessedRank ?? undefined);
  if (same) return { success: true };
  return { success: false, message: "指定カードが手札にありません。" };
}

function buildSelectablePlayers(candidatePlayers: typeof players.$inferSelect[], actingPlayerId: string, definition: (typeof CARD_DEFINITIONS)[CardId]) {
  const requiresTargetSelection = definition.target === "opponent" || definition.target === "any";
  const selectablePlayers = candidatePlayers.filter((p) => {
    if (p.id === actingPlayerId && definition.target === "opponent") return false;
    if (definition.target === "self" && p.id !== actingPlayerId) return false;
    if ((definition.target === "opponent" || definition.target === "any") && p.isEliminated) return false;
    if (definition.cannotTargetShielded && p.shield && p.id !== actingPlayerId) return false;
    return true;
  });
  return { requiresTargetSelection, selectablePlayers, hasSelectableTarget: requiresTargetSelection && selectablePlayers.length > 0 };
}

function validateTargetSelection(params: { definition: (typeof CARD_DEFINITIONS)[CardId]; hasSelectableTarget: boolean; requiresTargetSelection: boolean; guessedRank?: number; targetPlayer?: typeof players.$inferSelect; selectablePlayers: typeof players.$inferSelect[] }): GameActionResult | null {
  const { definition, hasSelectableTarget, guessedRank, requiresTargetSelection, targetPlayer, selectablePlayers } = params;
  if (definition.requiresGuess && hasSelectableTarget && (guessedRank === undefined || guessedRank === 1)) {
    return { success: false, message: "有効な推測値を入力してください。" };
  }
  if (requiresTargetSelection && hasSelectableTarget) {
    if (!targetPlayer) return { success: false, message: "対象プレイヤーを選択してください。" };
    if (!selectablePlayers.some((p) => p.id === targetPlayer.id)) return { success: false, message: "選択したプレイヤーを対象にできません。" };
  }
  if (targetPlayer?.shield && definition.cannotTargetShielded) return { success: false, message: "対象は守護状態です。" };
  return null;
}

export async function handlePlayCard(action: GameActionRequest, options?: { suppressAutoBot?: boolean }): Promise<GameActionResult> {
  const { cardId, targetId, guessedRank } = action.payload ?? {};
  if (!cardId) return { success: false, message: "cardId が必要です。" };

  let success = false;
  let runBotAfterCommit = false;
  try {
    const txResult: TxResult = await db.transaction(async (tx) => {
      const [game] = await tx.select().from(games).where(eq(games.id, action.gameId)).for("update");
      const gameValidationError = validateGameCanAcceptAction(game, action);
      if (gameValidationError) return gameValidationError;
      const currentGame = game;

      const playersInRoom = await tx.select().from(players).where(eq(players.roomId, action.roomId)).orderBy(players.seat).for("update");
      const actingPlayer = playersInRoom.find((p) => p.id === action.playerId);
      if (!actingPlayer || actingPlayer.isEliminated) return { success: false, message: "プレイヤー状態が不正です。" };
      const targetPlayer = targetId ? playersInRoom.find((p) => p.id === targetId) : undefined;

      const handRow = await tx.select().from(hands).where(and(eq(hands.gameId, currentGame.id), eq(hands.playerId, action.playerId))).for("update");
      const currentHand = handRow[0];
      if (!currentHand) return { success: false, message: "手札情報が見つかりません。" };

      const idempotentOrMissing = await validateCardInHandOrIdempotent(tx, currentGame.id, action.playerId, currentHand.cards as CardId[], cardId, targetId, guessedRank);
      if (idempotentOrMissing) return idempotentOrMissing;

      const definition = CARD_DEFINITIONS[cardId];
      if (!definition) return { success: false, message: "未知のカードです。" };

      const candidatePlayers = playersInRoom.filter((p) => p.role === "player");
      const selectable = buildSelectablePlayers(candidatePlayers, actingPlayer.id, definition);
      const targetValidationError = validateTargetSelection({ definition, guessedRank, targetPlayer, selectablePlayers: selectable.selectablePlayers, hasSelectableTarget: selectable.hasSelectableTarget, requiresTargetSelection: selectable.requiresTargetSelection });
      if (targetValidationError) return targetValidationError;

      const forcedCardError = validateForcedCard(currentHand.cards as CardId[], cardId);
      if (forcedCardError) return forcedCardError;

      const cardIndex = currentHand.cards.findIndex((c) => c === cardId);
      const updatedHand = [...currentHand.cards];
      updatedHand.splice(cardIndex, 1);
      await tx.update(hands).set({ cards: updatedHand, updatedAt: new Date() }).where(eq(hands.id, currentHand.id));

      const discardPile = [...(currentGame.discardPile as CardId[]), cardId];
      let deckState = currentGame.deckState as DeckState;
      const eliminationQueue: PlayerId[] = [];
      let logMessage = `${actingPlayer.nickname} が ${definition.name} を使用`;

      await tx.insert(actions).values({ gameId: currentGame.id, actorId: actingPlayer.id, type: "play_card", payload: { cardId, targetId: targetPlayer?.id ?? null, guessedRank: guessedRank ?? null } });

      const rulesPlayers: RulesPlayerSnapshot[] = await Promise.all(candidatePlayers.map(async (p) => ({ id: p.id, nickname: p.nickname, isSelf: p.id === actingPlayer.id, isEliminated: p.isEliminated, shield: p.shield, hand: ((await getHand(tx, currentGame.id, p.id))?.cards ?? []) as CardId[] })));
      const effectResult = resolveCardEffect({ actorId: actingPlayer.id, actorNickname: actingPlayer.nickname, cardId, actorHandAfterPlay: updatedHand as CardId[], targetId: targetPlayer?.id, guessedRank, players: rulesPlayers, drawPileCount: deckState.drawPile.length });
      if (!effectResult.ok) return { success: false, message: effectResult.message ?? "カード効果の解決に失敗しました。" };
      logMessage += effectResult.logSuffix;
      eliminationQueue.push(...effectResult.eliminatedPlayerIds);

      for (const instruction of effectResult.instructions) {
        if (instruction.type === "insert_action") {
          if (instruction.actionType !== "force_discard") {
            await tx.insert(actions).values({ gameId: currentGame.id, actorId: actingPlayer.id, type: instruction.actionType, payload: instruction.payload });
          }
        } else if (instruction.type === "set_shield") {
          await tx.update(players).set({ shield: true }).where(eq(players.id, instruction.playerId));
        } else if (instruction.type === "swap_hands") {
          await swapHands(tx, currentGame.id, instruction.playerA, instruction.playerB);
        } else if (instruction.type === "force_discard") {
          const discardResult = await resolveForceDiscard(tx, currentGame, deckState, instruction.targetId);
          deckState = discardResult.deckState;
          if (discardResult.eliminated) eliminationQueue.push(instruction.targetId);
          if (discardResult.discardedCard) {
            discardPile.push(discardResult.discardedCard);
            await tx.insert(actions).values({ gameId: currentGame.id, actorId: actingPlayer.id, type: "force_discard", payload: { targetId: instruction.targetId, cardId: discardResult.discardedCard } });
          }
        }
      }

      await tx.update(games).set({ discardPile, deckState, updatedAt: new Date() }).where(eq(games.id, currentGame.id));
      await tx.insert(logs).values({ gameId: currentGame.id, actorId: actingPlayer.id, message: logMessage, icon: definition.icon });
      if (eliminationQueue.length > 0) await eliminatePlayers(tx, eliminationQueue);

      const postPlayers = await tx.select().from(players).where(eq(players.roomId, action.roomId)).orderBy(players.seat);
      const survivors = postPlayers.filter((p) => !p.isEliminated && p.role === "player");
      if (survivors.length <= 1) {
        await concludeRound(tx, currentGame, survivors.map((p) => p.id), "elimination");
        return { success: true };
      }
      if (deckState.drawPile.length === 0) {
        const winnerIds = await determineWinnersByHand(tx, currentGame.id, survivors);
        await concludeRound(tx, currentGame, winnerIds, "deck_exhausted");
        return { success: true };
      }
      await advanceTurn(tx, currentGame, postPlayers);
      const [nextGame] = await tx.select().from(games).where(eq(games.id, currentGame.id));
      const nextPlayer = nextGame?.activePlayerId ? postPlayers.find((p) => p.id === nextGame.activePlayerId) : undefined;
      const shouldRunBot = !!(nextGame?.activePlayerId && nextGame.phase === "choose_card" && nextPlayer?.isBot && !nextPlayer.isEliminated);
      return { success: true, runBotAfterCommit: shouldRunBot };
    });
    success = !!txResult.success;
    runBotAfterCommit = !!txResult.runBotAfterCommit;
  } catch (error) {
    console.error("[handlePlayCard] transaction failed", error);
    return { success: false, message: "カード処理中にエラーが発生しました。" };
  }

  if (success) invalidateStateCache(action.roomId);
  if (runBotAfterCommit && !options?.suppressAutoBot) executeBotTurn(action.roomId).catch((error) => console.error("bot turn error", error));
  return { success };
}
