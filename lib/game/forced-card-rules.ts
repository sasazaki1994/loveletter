import { CARD_DEFINITIONS } from "@/lib/game/cards";
import type { CardId } from "@/lib/game/types";

const VIZIER_FORCED_PAIR: readonly CardId[] = ["arbiter", "legate"];

export function getForcedPlayableCard(cards: CardId[]): CardId | null {
  if (cards.includes("vizier") && cards.some((card) => VIZIER_FORCED_PAIR.includes(card))) {
    return "vizier";
  }

  if (cards.includes("marquise")) {
    const totalRank = cards.reduce((sum, card) => sum + CARD_DEFINITIONS[card].rank, 0);
    if (totalRank >= 12) {
      return "marquise";
    }
  }

  return null;
}
