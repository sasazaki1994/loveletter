import { and, eq } from "drizzle-orm";

import { draw } from "@/lib/game/deck";
import type { CardId } from "@/lib/game/types";
import { hands } from "@/drizzle/schema";

export type DeckState = { drawPile: CardId[]; burnCard: CardId | null };
import type { DbClient } from "@/lib/db/client";

export type TransactionClient = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

export async function getHand(tx: TransactionClient, gameId: string, playerId: string) {
  const rows = await tx
    .select()
    .from(hands)
    .where(and(eq(hands.gameId, gameId), eq(hands.playerId, playerId)));
  return rows[0] ?? null;
}

export async function swapHands(
  tx: TransactionClient,
  gameId: string,
  playerA: string,
  playerB: string,
) {
  const [handA, handB] = await Promise.all([
    getHand(tx, gameId, playerA),
    getHand(tx, gameId, playerB),
  ]);

  if (!handA || !handB) return;

  await Promise.all([
    tx
      .update(hands)
      .set({ cards: handB.cards, updatedAt: new Date() })
      .where(eq(hands.id, handA.id)),
    tx
      .update(hands)
      .set({ cards: handA.cards, updatedAt: new Date() })
      .where(eq(hands.id, handB.id)),
  ]);
}

export async function resolveForceDiscard(
  tx: TransactionClient,
  game: { id: string },
  deckState: DeckState,
  targetId: string,
) {
  const hand = await getHand(tx, game.id, targetId);
  if (!hand || hand.cards.length === 0) {
    return { deckState, eliminated: false, discardedCard: null as CardId | null };
  }

  const discarded = hand.cards[0] as CardId;
  const remaining = hand.cards.slice(1);

  await tx
    .update(hands)
    .set({ cards: remaining, updatedAt: new Date() })
    .where(eq(hands.id, hand.id));

  const eliminated = discarded === "emissary";

  if (eliminated) {
    return { deckState, eliminated, discardedCard: discarded };
  }

  const nextDraw = draw(deckState.drawPile);
  const newDeckState: DeckState = {
    drawPile: nextDraw.deck,
    burnCard: deckState.burnCard,
  };

  if (nextDraw.card) {
    await tx
      .update(hands)
      .set({ cards: [...remaining, nextDraw.card], updatedAt: new Date() })
      .where(eq(hands.id, hand.id));
  }

  return { deckState: newDeckState, eliminated, discardedCard: discarded };
}
