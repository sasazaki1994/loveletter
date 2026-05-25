import { eq } from "drizzle-orm";

import { draw } from "@/lib/game/deck";
import { games, hands, players } from "@/drizzle/schema";
import type { DeckState, TransactionClient } from "@/lib/server/game/hand-service";
import { getHand } from "@/lib/server/game/hand-service";

export async function beginTurn(
  tx: TransactionClient,
  gameRow: typeof games.$inferSelect,
  player: typeof players.$inferSelect,
) {
  const deckState = gameRow.deckState as DeckState;
  let workingDeck = [...deckState.drawPile];
  const hand = await getHand(tx, gameRow.id, player.id);
  if (!hand) return;

  if (!player.isEliminated) {
    const drawResult = draw(workingDeck);
    workingDeck = drawResult.deck;
    if (drawResult.card) {
      await tx.update(hands).set({ cards: [...hand.cards, drawResult.card], updatedAt: new Date() }).where(eq(hands.id, hand.id));
    }
  }

  await tx.update(players).set({ shield: false, lastActiveAt: new Date() }).where(eq(players.id, player.id));
  await tx.update(games).set({ phase: "choose_card", activePlayerId: player.id, turnIndex: player.seat, deckState: { ...deckState, drawPile: workingDeck }, updatedAt: new Date() }).where(eq(games.id, gameRow.id));
}

export async function advanceTurn(
  tx: TransactionClient,
  gameRow: typeof games.$inferSelect,
  playerRows: typeof players.$inferSelect[],
) {
  const orderedPlayers = playerRows.filter((p) => p.role === "player").sort((a, b) => a.seat - b.seat);
  const currentIndex = orderedPlayers.findIndex((p) => p.id === gameRow.activePlayerId);
  let nextIndex = (currentIndex + 1) % orderedPlayers.length;
  for (let i = 0; i < orderedPlayers.length; i += 1) {
    const candidate = orderedPlayers[(currentIndex + 1 + i) % orderedPlayers.length];
    if (!candidate.isEliminated) {
      nextIndex = (currentIndex + 1 + i) % orderedPlayers.length;
      break;
    }
  }
  const nextPlayer = orderedPlayers[nextIndex];
  if (!nextPlayer) return;
  const [freshGame] = await tx.select().from(games).where(eq(games.id, gameRow.id));
  await beginTurn(tx, freshGame, nextPlayer);
}
