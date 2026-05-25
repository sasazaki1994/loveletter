import type { CardId, ClientGameState } from "@/lib/game/types";
import type { DeckState } from "@/lib/server/game/hand-service";
import { actions, games, hands, logs, players } from "@/drizzle/schema";

type ActionRow = typeof actions.$inferSelect;

function buildDiscardMap(actionRows: ActionRow[]): Map<string, CardId[]> {
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

function mapPublicPlayers(playerRows: typeof players.$inferSelect[], handRows: typeof hands.$inferSelect[], discardMap: Map<string, CardId[]>) {
  return playerRows.filter((p) => p.role === "player").sort((a, b) => a.seat - b.seat).map((p) => ({
    id: p.id, nickname: p.nickname, seat: p.seat, shield: p.shield, isEliminated: p.isEliminated, isBot: p.isBot,
    discardPile: discardMap.get(p.id) ?? [], handCount: handRows.find((h) => h.playerId === p.id)?.cards.length ?? 0,
    lastActiveAt: p.lastActiveAt?.toISOString?.() ?? new Date().toISOString(),
  }));
}


function determineLogType(message: string): "elimination" | "win" | undefined {
  if (message.includes("脱落") || message.includes("自滅")) return "elimination";
  if (message.includes("勝利")) return "win";
  return undefined;
}

function mapLogs(logRows: typeof logs.$inferSelect[]): ClientGameState["logs"] {
  return logRows.slice().reverse().map((log) => ({ id: log.id, timestamp: log.createdAt.toISOString(), message: log.message, type: determineLogType(log.message), actorId: log.actorId ?? undefined, icon: (log.icon as ClientGameState["logs"][number]["icon"]) ?? "info" }));
}

function attachPerspectiveState(base: ClientGameState, playerRows: typeof players.$inferSelect[], handRows: typeof hands.$inferSelect[], perspectivePlayerId?: string) {
  if (!perspectivePlayerId) return;
  const hand = handRows.find((h) => h.playerId === perspectivePlayerId);
  if (!hand) return;
  base.self = { ...base.players.find((p) => p.id === perspectivePlayerId)!, hand: hand.cards as CardId[] } as ClientGameState["self"];
  base.hand = hand.cards as CardId[];
}

function attachEffectHints(base: ClientGameState, actionRows: ActionRow[], handRows: typeof hands.$inferSelect[], perspectivePlayerId?: string) {
  if (!perspectivePlayerId) return;
  const lastPeek = actionRows.slice().reverse().find((a) => a.type === "peek" && a.actorId === perspectivePlayerId);
  if (!lastPeek) return;
  const targetId = ((lastPeek.payload ?? {}) as { targetId?: string }).targetId;
  const targetTop = targetId ? (handRows.find((h) => h.playerId === targetId)?.cards?.[0] as CardId | undefined) : undefined;
  if (targetId && targetTop) base.effectHints = { ...(base.effectHints ?? {}), peek: { actionId: lastPeek.id, targetId, card: targetTop } };
}

function attachLastAction(base: ClientGameState, actionRows: ActionRow[]) {
  if (actionRows.length === 0) return;
  const a = actionRows[actionRows.length - 1]!;
  base.lastAction = { id: a.id, type: a.type, actorId: a.actorId, targetId: ((a.payload ?? {}) as { targetId?: string }).targetId };
}

export function mapToClientState(game: typeof games.$inferSelect, playerRows: typeof players.$inferSelect[], handRows: typeof hands.$inferSelect[], actionRows: ActionRow[], logRows: typeof logs.$inferSelect[], perspectivePlayerId?: string): ClientGameState {
  const drawPile = (game.deckState as DeckState).drawPile;
  const discardMap = buildDiscardMap(actionRows);
  const base: ClientGameState = {
    id: game.id, roomId: game.roomId, phase: game.phase, turnIndex: game.turnIndex, round: game.round, createdAt: game.createdAt.toISOString(), updatedAt: game.updatedAt.toISOString(), drawPileCount: drawPile.length, discardPile: game.discardPile as CardId[], revealedSetupCards: game.revealedSetupCards as CardId[], topDiscard: (game.discardPile as CardId[]).slice(-1)[0], players: mapPublicPlayers(playerRows, handRows, discardMap), activePlayerId: game.activePlayerId ?? undefined, awaitingPlayerId: game.awaitingPlayerId ?? undefined, logs: mapLogs(logRows), self: undefined, hand: undefined, result: (game.result ?? undefined) as ClientGameState["result"],
  };
  attachPerspectiveState(base, playerRows, handRows, perspectivePlayerId);
  attachEffectHints(base, actionRows, handRows, perspectivePlayerId);
  attachLastAction(base, actionRows);
  return base;
}
