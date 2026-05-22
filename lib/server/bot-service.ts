import { CARD_DEFINITIONS } from "@/lib/game/cards";
import { getForcedPlayableCard } from "@/lib/game/forced-card-rules";
import type { CardId } from "@/lib/game/types";

export function chooseBotCard(cards: CardId[]): CardId {
  if (cards.length === 0) {
    throw new TypeError("cards must be a non-empty array");
  }

  const forcedCard = getForcedPlayableCard(cards);
  if (forcedCard) return forcedCard;

  const sorted = [...cards].sort((a, b) => CARD_DEFINITIONS[a].rank - CARD_DEFINITIONS[b].rank);
  return sorted[0];
}
