import { CARD_DEFINITIONS } from "./cards";
import { buildDeckWithVariants, DEFAULT_VARIANT_CONFIG, type VariantConfig } from "./variants";
import type { CardId } from "./types";

export function buildFullDeck(config?: VariantConfig): CardId[] {
  // ベース構成にバリアント置換を適用
  const deck = buildDeckWithVariants(config ?? DEFAULT_VARIANT_CONFIG);
  return deck;
}

export function shuffleDeck(deck: CardId[], seed?: string): CardId[] {
  const working = [...deck];
  const random = seed ? seededRandom(seed) : Math.random;
  for (let i = working.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [working[i], working[j]] = [working[j], working[i]];
  }
  return working;
}

function seededRandom(seed: string) {
  let state = hashString(seed);
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function draw(deck: CardId[]): { card: CardId | undefined; deck: CardId[] } {
  if (deck.length === 0) {
    return { card: undefined, deck };
  }
  const [card, ...rest] = deck;
  return { card, deck: rest };
}

