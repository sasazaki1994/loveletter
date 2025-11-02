import type { CardId } from "./types";

// 各ランクのベースカードID
const BASE_BY_RANK: Record<1 | 2 | 3 | 4 | 5 | 6 | 7, CardId> = {
  1: "sentinel",
  2: "oracle",
  3: "duelist",
  4: "warder",
  5: "legate",
  6: "arbiter",
  7: "vizier",
};

// ベースのデッキ構成（カードIDを並べたリスト）
export const BASE_DECK_IDS: CardId[] = [
  // rank 1 (5)
  "sentinel", "sentinel", "sentinel", "sentinel", "sentinel",
  // rank 2 (2)
  "oracle", "oracle",
  // rank 3 (2)
  "duelist", "duelist",
  // rank 4 (2)
  "warder", "warder",
  // rank 5 (2)
  "legate", "legate",
  // rank 6 (1)
  "arbiter",
  // rank 7 (1)
  "vizier",
  // rank 8 (1)
  "emissary",
];

export type VariantConfig = Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, CardId>>;

export const DEFAULT_VARIANT_CONFIG: VariantConfig = {};

export function buildDeckWithVariants(config: VariantConfig = DEFAULT_VARIANT_CONFIG): CardId[] {
  const deck = [...BASE_DECK_IDS];

  for (const rankKey of [1, 2, 3, 4, 5, 6, 7] as const) {
    const variant = config[rankKey];
    if (!variant) continue;

    const baseId = BASE_BY_RANK[rankKey];

    if (rankKey === 6 || rankKey === 7) {
      // シングルトンは完全置換
      const index = deck.indexOf(baseId);
      if (index >= 0) deck[index] = variant;
      continue;
    }

    // 複数枚ランクは1枚のみ差し替え
    const index = deck.indexOf(baseId);
    if (index >= 0) deck[index] = variant;
  }

  return deck;
}


