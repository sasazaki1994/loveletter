import { CARD_DEFINITIONS } from "@/lib/game/cards";
import { getForcedPlayableCard } from "@/lib/game/forced-card-rules";
import type { CardId } from "@/lib/game/types";

export type BotDecisionInput = {
  selfId: string;
  hand: CardId[];
  players: { id: string; isEliminated: boolean; shield: boolean; handCount: number; discardPile: CardId[] }[];
};

export type BotDecision = { cardId: CardId; targetId?: string; guessedRank?: number };

export function chooseBotCard(cards: CardId[]): CardId {
  if (cards.length === 0) throw new Error("Bot hand is empty");
  const forcedCard = getForcedPlayableCard(cards);
  if (forcedCard) return forcedCard;
  return [...cards].sort((a, b) => CARD_DEFINITIONS[a].rank - CARD_DEFINITIONS[b].rank)[0];
}

function chooseGuessFromDiscard(discardPile: CardId[]): number {
  const seen = new Set(discardPile.map((c) => CARD_DEFINITIONS[c].rank));
  for (const rank of [2, 3, 4, 5, 6, 7, 8]) {
    if (!seen.has(rank)) return rank;
  }
  return 2;
}

export function chooseBotAction(input: BotDecisionInput): BotDecision {
  const forcedCard = getForcedPlayableCard(input.hand);
  const aliveTargets = input.players.filter((p) => p.id !== input.selfId && !p.isEliminated && !p.shield && p.handCount > 0);
  const sorted = [...input.hand].sort((a, b) => CARD_DEFINITIONS[a].rank - CARD_DEFINITIONS[b].rank);
  const nonEmissary = sorted.filter((c) => c !== "emissary");
  const cardId = forcedCard ?? nonEmissary[0] ?? sorted[0];
  const target = aliveTargets[0];
  const targetId = CARD_DEFINITIONS[cardId].target === "self" ? input.selfId : target?.id;
  const guessedRank = CARD_DEFINITIONS[cardId].requiresGuess ? chooseGuessFromDiscard(target?.discardPile ?? []) : undefined;
  return { cardId, targetId, guessedRank };
}
