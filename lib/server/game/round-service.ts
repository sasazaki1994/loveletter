import { and, eq, inArray } from "drizzle-orm";

import { CARD_DEFINITIONS } from "@/lib/game/cards";
import type { CardId } from "@/lib/game/types";
import { games, hands, logs, players, rooms } from "@/drizzle/schema";
import type { TransactionClient } from "@/lib/server/game/hand-service";

export function determineWinnersByHandFromCards(
  contenders: { playerId: string; cards: CardId[] }[],
): string[] {
  let maxRank = -1;
  let winners: string[] = [];
  for (const contender of contenders) {
    if (contender.cards.length === 0) continue;
    const highest = Math.max(...contender.cards.map((card) => CARD_DEFINITIONS[card].rank));
    if (highest > maxRank) {
      maxRank = highest;
      winners = [contender.playerId];
    } else if (highest === maxRank) {
      winners.push(contender.playerId);
    }
  }
  return winners;
}

export async function determineWinnersByHand(
  tx: TransactionClient,
  gameId: string,
  survivors: typeof players.$inferSelect[],
) {
  const handRows = await tx.select().from(hands).where(and(eq(hands.gameId, gameId), inArray(hands.playerId, survivors.map((p) => p.id))));
  return determineWinnersByHandFromCards(
    survivors.map((p) => ({ playerId: p.id, cards: (handRows.find((h) => h.playerId === p.id)?.cards ?? []) as CardId[] })),
  );
}

export async function concludeRound(
  tx: TransactionClient,
  game: typeof games.$inferSelect,
  winnerIds: string[],
  reason: string,
) {
  let finalHands: Record<string, CardId[]> | undefined;
  if (reason === "deck_exhausted") {
    const allPlayers = await tx.select().from(players).where(eq(players.roomId, game.roomId));
    const survivors = allPlayers.filter((p) => !p.isEliminated && p.role === "player");
    const handRows = await tx.select().from(hands).where(and(eq(hands.gameId, game.id), inArray(hands.playerId, survivors.map((p) => p.id))));
    finalHands = {};
    for (const handRow of handRows) finalHands[handRow.playerId] = handRow.cards as CardId[];
  }

  await tx.update(games).set({ phase: "finished", result: finalHands ? { winnerIds, reason, finalHands } : { winnerIds, reason }, updatedAt: new Date() }).where(eq(games.id, game.id));
  await tx.update(rooms).set({ status: "finished", updatedAt: new Date() }).where(eq(rooms.id, game.roomId));

  const winners = await tx.select({ id: players.id, nickname: players.nickname }).from(players).where(inArray(players.id, winnerIds));
  const message = winners.length > 0 ? `${winners.map((w) => w.nickname).join(" / ")} が勝利しました。` : "このラウンドは引き分けです。";
  await tx.insert(logs).values({ gameId: game.id, message, icon: "crown" });
}

export async function eliminatePlayers(tx: TransactionClient, playerIds: string[]) {
  if (playerIds.length === 0) return;
  await tx.update(players).set({ isEliminated: true }).where(inArray(players.id, playerIds));
}
