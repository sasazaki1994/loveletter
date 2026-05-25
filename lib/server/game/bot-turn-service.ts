import { and, eq } from "drizzle-orm";

import { db, type DbClient } from "@/lib/db/client";
import type { CardId, GameActionRequest } from "@/lib/game/types";
import { chooseBotAction, type BotDecisionInput } from "@/lib/server/bot-service";
import { actions, games, hands, players } from "@/drizzle/schema";
import { getHand } from "@/lib/server/game/hand-service";
import { handlePlayCard } from "@/lib/server/game/action-service";

const BOT_FALLBACK_THINK_TIME_MS = 2500;
const BOT_THINK_JITTER_RATIO = 0.4;

type DelayedTurnSnapshot = { gameId: string; activePlayerId: string; turnIndex: number };

function buildDiscardMap(actionRows: typeof actions.$inferSelect[]): Map<string, CardId[]> {
  const discardMap = new Map<string, CardId[]>();
  for (const action of actionRows) {
    if (action.type === "play_card" && action.actorId) {
      const payload = action.payload as { cardId?: CardId } | null;
      if (payload?.cardId) discardMap.set(action.actorId, [...(discardMap.get(action.actorId) ?? []), payload.cardId]);
    }
    if (action.type === "force_discard") {
      const payload = action.payload as { targetId?: string; cardId?: CardId } | null;
      if (payload?.targetId && payload.cardId) discardMap.set(payload.targetId, [...(discardMap.get(payload.targetId) ?? []), payload.cardId]);
    }
  }
  return discardMap;
}

type QueryClient = DbClient | Parameters<Parameters<DbClient["transaction"]>[0]>[0];

async function buildBotDecisionInput(tx: QueryClient, roomId: string, gameId: string, selfId: string, hand: CardId[]): Promise<BotDecisionInput> {
  const [roomPlayers, handRows, actionRows] = await Promise.all([
    tx.select().from(players).where(and(eq(players.roomId, roomId), eq(players.role, "player"))),
    tx.select().from(hands).where(eq(hands.gameId, gameId)),
    tx.select().from(actions).where(eq(actions.gameId, gameId)),
  ]);
  const handCountMap = new Map(handRows.map((h) => [h.playerId, h.cards.length]));
  const discardMap = buildDiscardMap(actionRows);
  return {
    selfId,
    hand,
    players: roomPlayers.map((p) => ({ id: p.id, isEliminated: p.isEliminated, shield: p.shield, handCount: handCountMap.get(p.id) ?? 0, discardPile: discardMap.get(p.id) ?? [] })),
  };
}

export async function executeBotTurn(roomId: string, options?: { skipThinkDelay?: boolean }) {
  let delayedTurnSnapshot: DelayedTurnSnapshot | null = null;
  if (!options?.skipThinkDelay) {
    const [beforeDelayGame] = await db.select({ id: games.id, activePlayerId: games.activePlayerId, turnIndex: games.turnIndex, phase: games.phase }).from(games).where(eq(games.roomId, roomId));
    if (!beforeDelayGame || beforeDelayGame.phase !== "choose_card" || !beforeDelayGame.activePlayerId) return;
    delayedTurnSnapshot = { gameId: beforeDelayGame.id, activePlayerId: beforeDelayGame.activePlayerId, turnIndex: beforeDelayGame.turnIndex };
    const jitterMultiplier = 1 - BOT_THINK_JITTER_RATIO / 2 + Math.random() * BOT_THINK_JITTER_RATIO;
    const thinkDelay = Math.max(0, Math.round(BOT_FALLBACK_THINK_TIME_MS * jitterMultiplier));
    await new Promise<void>((resolve) => setTimeout(resolve, thinkDelay));
  }

  const botAction = await db.transaction(async (tx) => {
    const [game] = await tx.select().from(games).where(delayedTurnSnapshot ? eq(games.id, delayedTurnSnapshot.gameId) : eq(games.roomId, roomId));
    if (!game || game.phase !== "choose_card" || !game.activePlayerId) return null;
    if (delayedTurnSnapshot && (game.activePlayerId !== delayedTurnSnapshot.activePlayerId || game.turnIndex !== delayedTurnSnapshot.turnIndex)) return null;

    const [botPlayer] = await tx.select().from(players).where(and(eq(players.id, game.activePlayerId), eq(players.isBot, true)));
    if (!botPlayer || botPlayer.isEliminated) return null;
    const hand = await getHand(tx, game.id, game.activePlayerId);
    if (!hand || hand.cards.length === 0) return null;

    const decisionInput = await buildBotDecisionInput(tx, roomId, game.id, botPlayer.id, hand.cards as CardId[]);
    const decision = chooseBotAction(decisionInput);
    return {
      gameId: game.id,
      roomId,
      playerId: game.activePlayerId,
      type: "play_card" as const,
      payload: { cardId: decision.cardId, targetId: decision.targetId, guessedRank: decision.guessedRank },
    } satisfies GameActionRequest;
  });

  if (botAction) await handlePlayCard(botAction);
}
