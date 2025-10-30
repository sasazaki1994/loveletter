import { CardDefinition } from "./types";

export const CARD_DEFINITIONS: Record<CardDefinition["id"], CardDefinition> = {
  sentinel: {
    id: "sentinel",
    name: "Sentinel of Whispers",
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
    name: "Oracle of Veils",
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
    name: "Duelist of Courts",
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
    name: "Warder of Aegis",
    rank: 4,
    copies: 2,
    effectType: "shield",
    description: "次の手番開始まで自分を守護し、ターゲット不可にする。",
    icon: "shield",
    target: "self",
  },
  legate: {
    id: "legate",
    name: "Legate of Cinders",
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
    name: "Arbiter of Mirrors",
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
    name: "Vizier of Silence",
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
    name: "Emissary of Radiance",
    rank: 8,
    copies: 1,
    effectType: "self_eliminate",
    description: "このカードを捨てた場合、即座に脱落する。",
    icon: "flame",
    target: "self",
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

