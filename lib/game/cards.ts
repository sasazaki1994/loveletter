import { CardDefinition } from "./types";

export const CARD_DEFINITIONS: Record<CardDefinition["id"], CardDefinition> = {
  sentinel: {
    id: "sentinel",
    name: "Guard",
    rank: 1,
    copies: 5,
    effectType: "guess_eliminate",
    description:
      "指名した相手の手札を数値で推測し、的中したら脱落させる。Sentinel 自身の数字は推測不可。",
    icon: "mask",
    target: "opponent",
    requiresGuess: true,
    cannotTargetShielded: true,
  },
  oracle: {
    id: "oracle",
    name: "Priest",
    rank: 2,
    copies: 2,
    effectType: "peek",
    description: "相手 1 人の手札をひっそりと覗き見る。",
    icon: "eye",
    target: "opponent",
    cannotTargetShielded: true,
  },
  duelist: {
    id: "duelist",
    name: "Baron",
    rank: 3,
    copies: 2,
    effectType: "compare",
    description:
      "互いの手札を公開し、数値の低い側が脱落する。引き分けなら双方生存。",
    icon: "swords",
    target: "opponent",
    cannotTargetShielded: true,
  },
  warder: {
    id: "warder",
    name: "Handmaid",
    rank: 4,
    copies: 2,
    effectType: "shield",
    description: "次の手番開始まで自分を守護し、ターゲット不可にする。",
    icon: "shield",
    target: "self",
  },
  legate: {
    id: "legate",
    name: "Prince",
    rank: 5,
    copies: 2,
    effectType: "force_discard",
    description:
      "対象の手札を捨てさせ、新しい 1 枚を引かせる。Princess を捨てさせた場合は脱落。",
    icon: "quill",
    target: "any",
  },
  arbiter: {
    id: "arbiter",
    name: "King",
    rank: 6,
    copies: 1,
    effectType: "swap_hands",
    description: "自分と対象の手札を入れ替える。",
    icon: "balance",
    target: "opponent",
    cannotTargetShielded: true,
  },
  vizier: {
    id: "vizier",
    name: "Countess",
    rank: 7,
    copies: 1,
    effectType: "conditional_discard",
    description:
      "手札に Arbiter か Legate がある場合はこのカードを即座に捨てなければならない。",
    icon: "crown",
    target: "none",
    notes: "強制廃棄時は効果なし。捨札公開のみ。",
  },
  emissary: {
    id: "emissary",
    name: "Princess",
    rank: 8,
    copies: 1,
    effectType: "self_eliminate",
    description: "このカードを捨てた場合、即座に脱落する。",
    icon: "flame",
    target: "self",
  },
  // --- Optional swap-ins (disabled by default via deck builder) ---
  feint: {
    id: "feint",
    name: "Feint",
    rank: 1,
    copies: 1, // replaces 1 of 5
    effectType: "guess_reveal",
    description:
      "相手の手札を数値で推測。的中: 相手は手札を公開（捨てない）。外れ: あなたが手札を公開。",
    icon: "mask",
    target: "opponent",
    requiresGuess: true,
    cannotTargetShielded: true,
  },
  insight: {
    id: "insight",
    name: "Insight",
    rank: 2,
    copies: 1, // replaces 1 of 2
    effectType: "peek", // NOTE: placeholder effect type; deck toggle is off by default
    description: "山札の上から2枚を見る。1枚を上、1枚を下に置く。",
    icon: "eye",
    target: "none",
  },
  standoff: {
    id: "standoff",
    name: "Standoff",
    rank: 3,
    copies: 1, // replaces 1 of 2
    effectType: "compare",
    description: "互いに公開し、小さい値の側が捨てる。同値なら効果なし。",
    icon: "swords",
    target: "opponent",
    cannotTargetShielded: true,
  },
  wager: {
    id: "wager",
    name: "Wager",
    rank: 4,
    copies: 1, // replaces 1 of 2
    effectType: "guess_reveal",
    description:
      "相手の手札を数値で推測。的中: 相手は手札を公開（捨てない）。外れ: あなたが手札を公開。",
    icon: "mask",
    target: "opponent",
    requiresGuess: true,
    cannotTargetShielded: true,
  },
  ambush: {
    id: "ambush",
    name: "Ambush",
    rank: 6,
    copies: 1, // replaces 1 of 1
    effectType: "swap_hands",
    description: "対象の手札を密かに見て、入れ替えるかどうかを選べる（公開しない）。",
    icon: "balance",
    target: "opponent",
    cannotTargetShielded: true,
  },
  marquise: {
    id: "marquise",
    name: "Marquise",
    rank: 7,
    copies: 1, // replaces 1 of 1
    effectType: "conditional_discard",
    description: "手札の合計が12以上なら、このカードを優先して使用しなければならない。",
    icon: "crown",
    target: "none",
  },
};

export const ORDERED_CARD_IDS = Object.keys(
  CARD_DEFINITIONS,
) as CardDefinition["id"][];

export const CARD_POOL: CardDefinition[] = ORDERED_CARD_IDS.map(
  (cardId) => CARD_DEFINITIONS[cardId],
);

export const TOTAL_CARD_COUNT = CARD_POOL.reduce(
  (acc, card) => acc + card.copies,
  0,
);

