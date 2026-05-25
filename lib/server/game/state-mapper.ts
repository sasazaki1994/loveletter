import type { CardId, ClientGameState } from "@/lib/game/types";
import type { DeckState } from "@/lib/server/game/hand-service";
import { actions, games, hands, logs, players } from "@/drizzle/schema";

export function mapToClientState(
  game: typeof games.$inferSelect,
  playerRows: typeof players.$inferSelect[],
  handRows: typeof hands.$inferSelect[],
  actionRows: typeof actions.$inferSelect[],
  logRows: typeof logs.$inferSelect[],
  perspectivePlayerId?: string,
): ClientGameState {
  const drawPile = (game.deckState as DeckState).drawPile;
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
  const base: ClientGameState = { id: game.id, roomId: game.roomId, phase: game.phase, turnIndex: game.turnIndex, round: game.round, createdAt: game.createdAt.toISOString(), updatedAt: game.updatedAt.toISOString(), drawPileCount: drawPile.length, discardPile: game.discardPile as CardId[], revealedSetupCards: game.revealedSetupCards as CardId[], topDiscard: (game.discardPile as CardId[]).slice(-1)[0], players: playerRows.filter((p) => p.role === "player").sort((a,b)=>a.seat-b.seat).map((p)=>({id:p.id,nickname:p.nickname,seat:p.seat,shield:p.shield,isEliminated:p.isEliminated,isBot:p.isBot,discardPile:discardMap.get(p.id)??[],handCount:handRows.find((h)=>h.playerId===p.id)?.cards.length??0,lastActiveAt:p.lastActiveAt?.toISOString?.()??new Date().toISOString()})), activePlayerId: game.activePlayerId ?? undefined, awaitingPlayerId: game.awaitingPlayerId ?? undefined, logs: logRows.slice().reverse().map((log)=>({id:log.id,timestamp:log.createdAt.toISOString(),message:log.message,type:log.message.includes("脱落")||log.message.includes("自滅")?"elimination":log.message.includes("勝利")?"win":undefined,actorId:log.actorId??undefined,icon:(log.icon as ClientGameState["logs"][number]["icon"])??"info"})), self: undefined, hand: undefined, result: (game.result ?? undefined) as ClientGameState["result"] };
  if (perspectivePlayerId) {
    const hand = handRows.find((h) => h.playerId === perspectivePlayerId);
    const playerInfo = playerRows.find((p) => p.id === perspectivePlayerId);
    if (hand && playerInfo) { base.self = { ...base.players.find((p)=>p.id===perspectivePlayerId)!, hand: hand.cards as CardId[] } as ClientGameState["self"]; base.hand = hand.cards as CardId[]; }
    const lastPeek = actionRows.slice().reverse().find((a) => a.type === "peek" && a.actorId === perspectivePlayerId);
    if (lastPeek) {
      const targetId = ((lastPeek.payload ?? {}) as { targetId?: string }).targetId;
      const targetTop = targetId ? (handRows.find((h) => h.playerId === targetId)?.cards?.[0] as CardId | undefined) : undefined;
      if (targetId && targetTop) base.effectHints = { ...(base.effectHints ?? {}), peek: { actionId: lastPeek.id, targetId, card: targetTop } };
    }
  }
  if (actionRows.length > 0) {
    const a = actionRows[actionRows.length - 1]!;
    base.lastAction = { id: a.id, type: a.type, actorId: a.actorId, targetId: ((a.payload ?? {}) as { targetId?: string }).targetId };
  }
  return base;
}
