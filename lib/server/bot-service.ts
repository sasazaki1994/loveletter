import { CARD_DEFINITIONS } from "@/lib/game/cards";
import { getForcedPlayableCard } from "@/lib/game/forced-card-rules";
import type { CardId } from "@/lib/game/types";

export type BotDecisionInput = {
  selfId: string;
  hand: CardId[];
  players: { id: string; isEliminated: boolean; shield: boolean; handCount: number; discardPile: CardId[] }[];
};

export type BotDecision = { cardId: CardId; targetId?: string; guessedRank?: number };
type BotTarget = BotDecisionInput["players"][number];

export function chooseBotCard(cards: CardId[]): CardId {
  if (cards.length === 0) throw new Error("Bot hand is empty");
  const forcedCard = getForcedPlayableCard(cards);
  if (forcedCard) return forcedCard;
  return [...cards].sort((a, b) => CARD_DEFINITIONS[a].rank - CARD_DEFINITIONS[b].rank)[0];
}

export function chooseGuessRank(discardPile: CardId[]): number {
  const seen = new Set(discardPile.map((c) => CARD_DEFINITIONS[c].rank));
  for (const rank of [8, 7, 6, 5, 4, 3, 2]) {
    if (!seen.has(rank)) return rank;
  }
  return 2;
}

export function getRemainingHandAfterPlay(hand: CardId[], cardId: CardId): CardId[] {
  const idx = hand.indexOf(cardId);
  if (idx < 0) return [...hand];
  return [...hand.slice(0, idx), ...hand.slice(idx + 1)];
}

export function getLegalBotTargets(input: BotDecisionInput, cardId: CardId): BotTarget[] {
  const def = CARD_DEFINITIONS[cardId];
  if (def.target === "none") return [];
  if (def.target === "self") {
    return input.players.filter((p) => p.id === input.selfId && !p.isEliminated);
  }
  return input.players.filter((p) => {
    if (p.id === input.selfId) return def.target === "any";
    if (p.isEliminated || p.handCount <= 0) return false;
    if (def.cannotTargetShielded && p.shield) return false;
    return true;
  });
}

export function chooseBestTarget(input: BotDecisionInput, cardId: CardId): BotTarget | undefined {
  const legalTargets = getLegalBotTargets(input, cardId);
  if (legalTargets.length === 0) return undefined;
  const def = CARD_DEFINITIONS[cardId];
  if (def.target === "self") return legalTargets[0];
  const opponents = legalTargets.filter((p) => p.id !== input.selfId);
  if (opponents.length === 0) return legalTargets[0];
  const byPriority = [...opponents].sort((a, b) => a.handCount - b.handCount || a.id.localeCompare(b.id));
  return byPriority[0];
}

export function chooseBotAction(input: BotDecisionInput): BotDecision {
  const forcedCard = getForcedPlayableCard(input.hand);
  const sorted = [...input.hand].sort((a, b) => CARD_DEFINITIONS[a].rank - CARD_DEFINITIONS[b].rank);
  const remainingRank = (cardId: CardId) => CARD_DEFINITIONS[getRemainingHandAfterPlay(input.hand, cardId)[0] ?? cardId].rank;
  const selectable = sorted.filter((cardId) => getLegalBotTargets(input, cardId).length > 0 || CARD_DEFINITIONS[cardId].target === "none");
  const nonEmissary = selectable.filter((c) => c !== "emissary");
  const safeCandidates = nonEmissary.filter((cardId) => {
    if (cardId === "duelist") return remainingRank(cardId) >= 5;
    if (cardId === "arbiter") return remainingRank(cardId) <= 4;
    return true;
  });
  const preferredArbiter = safeCandidates.includes("arbiter") && remainingRank("arbiter") <= 4 ? "arbiter" : undefined;
  const preferredDuelist = safeCandidates.includes("duelist") && remainingRank("duelist") >= 5 ? "duelist" : undefined;
  const cardId = forcedCard ?? preferredArbiter ?? preferredDuelist ?? safeCandidates[0] ?? nonEmissary[0] ?? selectable[0] ?? sorted[0];
  const target = chooseBestTarget(input, cardId);
  const targetId = target?.id;
  const guessedRank = CARD_DEFINITIONS[cardId].requiresGuess ? chooseGuessRank(target?.discardPile ?? []) : undefined;
  return { cardId, targetId, guessedRank };
}
