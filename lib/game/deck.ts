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

// --- E2E test overrides ---

export type TestDeckOverrides = {
  seed?: string;
  fixedDeck?: CardId[];
};

/**
 * E2E専用のデッキ/シード上書き設定を環境変数から取得する。
 * 本番(NODE_ENV=production)では無効。
 *
 * 環境変数:
 * - E2E_TEST_MODE: '1' のときのみ有効
 * - E2E_SEED: シャッフルシード（文字列）
 * - E2E_DECK: カードIDをカンマ/空白区切りで列挙（先頭が山札トップ）
 */
export function getTestDeckOverrides(): TestDeckOverrides | null {
  if (process.env.NODE_ENV === "production") return null;
  const enabled = process.env.E2E_TEST_MODE === "1";
  if (!enabled) return null;

  const seed = process.env.E2E_SEED?.trim();
  const deckSpec = process.env.E2E_DECK?.trim();
  let fixedDeck: CardId[] | undefined;

  if (deckSpec && deckSpec.length > 0) {
    const parts = deckSpec.split(/[\s,]+/).filter(Boolean);
    const valid: CardId[] = [];
    for (const token of parts) {
      if ((CARD_DEFINITIONS as any)[token]) {
        valid.push(token as CardId);
      }
    }
    if (valid.length > 0) {
      fixedDeck = valid;
    }
  }

  return { seed, fixedDeck };
}

